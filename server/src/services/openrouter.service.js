import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export const DEFAULT_SYSTEM_PROMPT = `You are "Ava", a friendly and professional customer support assistant for an online store.
Goals: understand the customer's issue, give clear, accurate, concise help, and resolve it in as few turns as possible.
Rules:
- Be polite, empathetic and solution-oriented. Use short paragraphs or bullet steps.
- You do not have access to real order, account or payment systems. Never invent order numbers, tracking data, prices, policies or refunds. When specific account data is needed, explain what information the customer should prepare and that a human agent can verify it.
- Ask a clarifying question when the request is ambiguous.
- If the customer is angry, acknowledge their feelings before solving.
- Offer to escalate to a human agent for billing disputes, legal issues, security concerns or when you cannot help.
- Never request full card numbers, passwords or one-time codes.
- Stay on customer-support topics; politely decline unrelated or harmful requests.
- Format answers with Markdown when it improves readability.`;

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_BACKOFF_MS = 4000;
const MAX_RETRY_AFTER_MS = 5000;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Keeps the newest messages that fit the character budget (newest always kept),
 * in chronological order, starting with a user turn.
 */
export function buildContext(history, maxChars) {
  const kept = [];
  let total = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const { role, content } = history[i];
    if (kept.length > 0 && total + content.length > maxChars) break;
    kept.unshift({ role, content });
    total += content.length;
  }
  while (kept.length > 1 && kept[0].role !== 'user') kept.shift();
  return kept;
}

function isRetryable(failure) {
  if (failure.kind === 'timeout' || failure.kind === 'network') return true;
  return (failure.kind === 'http' || failure.kind === 'provider') && RETRYABLE_STATUS.has(failure.status);
}

function describeFailure(failure) {
  const parts = [failure.kind];
  if (failure.status) parts.push(`status=${failure.status}`);
  if (failure.detail) parts.push(`detail=${failure.detail}`);
  return parts.join(' ');
}

export function toAppError(failure) {
  if (failure.kind === 'timeout') {
    return new AppError(504, 'AI_TIMEOUT', 'AI service timed out. Please try again.');
  }
  if (failure.kind === 'empty') {
    return new AppError(502, 'AI_EMPTY_RESPONSE', 'AI service returned an empty response. Please try again.');
  }
  const { status } = failure;
  if (status === 401 || status === 403) {
    return new AppError(502, 'AI_AUTH_ERROR', 'AI service is not configured correctly. Please contact support.');
  }
  if (status === 429) {
    return new AppError(503, 'AI_RATE_LIMITED', 'AI service is busy. Please try again shortly.');
  }
  if ([400, 402, 404, 413, 422].includes(status)) {
    return new AppError(502, 'AI_BAD_REQUEST', 'AI service rejected the request.');
  }
  return new AppError(502, 'AI_PROVIDER_ERROR', 'AI service is temporarily unavailable. Please try again.');
}

export function createOpenRouterClient(
  env,
  { fetchImpl = globalThis.fetch, sleep = defaultSleep, random = Math.random } = {},
) {
  const url = `${env.OPENROUTER_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const systemPrompt = env.AI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
  const headers = {
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': env.OPENROUTER_APP_URL,
    'X-Title': env.OPENROUTER_APP_NAME,
  };

  async function attempt(messages) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: env.OPENROUTER_MODEL,
          messages,
          max_tokens: env.AI_MAX_TOKENS,
          temperature: env.AI_TEMPERATURE,
        }),
        signal: controller.signal,
      });
      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!response.ok) {
        return {
          ok: false,
          kind: 'http',
          status: response.status,
          retryAfter: Number(response.headers.get('retry-after')) || undefined,
          detail: text.slice(0, 300),
        };
      }
      if (json?.error) {
        const code = Number(json.error.code);
        return {
          ok: false,
          kind: 'provider',
          status: Number.isInteger(code) ? code : undefined,
          detail: String(json.error.message ?? '').slice(0, 300),
        };
      }

      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) return { ok: false, kind: 'empty' };

      return {
        ok: true,
        content: content.trim(),
        model: typeof json.model === 'string' ? json.model : env.OPENROUTER_MODEL,
        usage: json.usage
          ? {
              promptTokens: json.usage.prompt_tokens,
              completionTokens: json.usage.completion_tokens,
              totalTokens: json.usage.total_tokens,
            }
          : undefined,
      };
    } catch (err) {
      if (controller.signal.aborted) return { ok: false, kind: 'timeout' };
      return { ok: false, kind: 'network', detail: err?.message };
    } finally {
      clearTimeout(timer);
    }
  }

  function backoffMs(attemptIndex, failure) {
    if (failure.retryAfter) return Math.min(failure.retryAfter * 1000, MAX_RETRY_AFTER_MS);
    return Math.min(500 * 2 ** attemptIndex, MAX_BACKOFF_MS) + Math.floor(random() * 250);
  }

  return {
    model: env.OPENROUTER_MODEL,

    /** history: chronological [{ role: 'user'|'assistant', content }], newest last. */
    async complete(history) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...buildContext(history, env.AI_CONTEXT_MAX_CHARS),
      ];

      let failure;
      for (let i = 0; i <= env.AI_MAX_RETRIES; i += 1) {
        const result = await attempt(messages);
        if (result.ok) {
          const { ok, ...reply } = result;
          return reply;
        }
        failure = result;
        logger.warn(`OpenRouter attempt ${i + 1}/${env.AI_MAX_RETRIES + 1} failed: ${describeFailure(failure)}`);
        if (!isRetryable(failure) || i === env.AI_MAX_RETRIES) break;
        await sleep(backoffMs(i, failure));
      }
      throw toAppError(failure);
    },
  };
}
