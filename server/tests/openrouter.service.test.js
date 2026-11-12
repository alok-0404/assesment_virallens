import { describe, it, expect, vi } from 'vitest';
import {
  createOpenRouterClient,
  buildContext,
  DEFAULT_SYSTEM_PROMPT,
} from '../src/services/openrouter.service.js';
import { testEnv } from './helpers/env.js';

const okBody = (content = 'Hello! How can I help?') => ({
  id: 'gen-1',
  model: 'openai/gpt-4o-mini',
  choices: [{ message: { role: 'assistant', content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function sequenceFetch(...responses) {
  const fn = vi.fn(async () => {
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : next;
  });
  return fn;
}

const history = [{ role: 'user', content: 'My order is late' }];

function makeClient(fetchImpl, envOverrides = {}) {
  const sleep = vi.fn(async () => {});
  const env = testEnv({ AI_MAX_RETRIES: '2', ...envOverrides });
  const client = createOpenRouterClient(env, { fetchImpl, sleep, random: () => 0 });
  return { client, sleep, env };
}

describe('OpenRouter client', () => {
  it('sends the documented request and returns the reply', async () => {
    const fetchImpl = sequenceFetch(jsonResponse(okBody('  Sorry about that!  ')));
    const { client } = makeClient(fetchImpl, {
      OPENROUTER_MODEL: 'test/model',
      AI_MAX_TOKENS: '256',
      AI_TEMPERATURE: '0.5',
    });

    const reply = await client.complete(history);

    expect(reply).toEqual({
      content: 'Sorry about that!',
      model: 'openai/gpt-4o-mini',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-openrouter-key');
    expect(init.headers['X-Title']).toBe('AI Customer Support Agent');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      model: 'test/model',
      max_tokens: 256,
      temperature: 0.5,
      messages: [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }, ...history],
    });
  });

  it('uses AI_SYSTEM_PROMPT when configured', async () => {
    const fetchImpl = sequenceFetch(jsonResponse(okBody()));
    const { client } = makeClient(fetchImpl, { AI_SYSTEM_PROMPT: 'You are a test bot.' });
    await client.complete(history);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).messages[0]).toEqual({
      role: 'system',
      content: 'You are a test bot.',
    });
  });

  it('retries on 5xx and succeeds', async () => {
    const fetchImpl = sequenceFetch(jsonResponse({ error: { message: 'down' } }, 503), jsonResponse(okBody()));
    const { client, sleep } = makeClient(fetchImpl);
    const reply = await client.complete(history);
    expect(reply.content).toBe('Hello! How can I help?');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it('retries on network errors with exponential backoff, then fails with AI_PROVIDER_ERROR', async () => {
    const fetchImpl = sequenceFetch(new TypeError('fetch failed'), new TypeError('fetch failed'), jsonResponse({}, 500));
    const { client, sleep } = makeClient(fetchImpl);
    await expect(client.complete(history)).rejects.toMatchObject({ status: 502, code: 'AI_PROVIDER_ERROR' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000]);
  });

  it('does not retry an invalid API key (401) and maps to AI_AUTH_ERROR', async () => {
    const fetchImpl = sequenceFetch(jsonResponse({ error: { message: 'No auth credentials found', code: 401 } }, 401));
    const { client } = makeClient(fetchImpl);
    const error = await client.complete(history).catch((e) => e);
    expect(error).toMatchObject({ status: 502, code: 'AI_AUTH_ERROR' });
    expect(error.message).not.toContain('test-openrouter-key');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps a persistent 429 to AI_RATE_LIMITED and honours Retry-After', async () => {
    const limited = () => jsonResponse({ error: { message: 'rate limited' } }, 429, { 'Retry-After': '2' });
    const fetchImpl = sequenceFetch(limited, limited, limited);
    const { client, sleep } = makeClient(fetchImpl);
    await expect(client.complete(history)).rejects.toMatchObject({ status: 503, code: 'AI_RATE_LIMITED' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 2000]);
  });

  it('times out slow requests with AI_TIMEOUT', async () => {
    const hang = vi.fn(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const { client } = makeClient(hang, { AI_TIMEOUT_MS: '1000', AI_MAX_RETRIES: '0' });
    const started = Date.now();
    await expect(client.complete(history)).rejects.toMatchObject({ status: 504, code: 'AI_TIMEOUT' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(950);
    expect(hang).toHaveBeenCalledTimes(1);
  });

  it('treats empty content as AI_EMPTY_RESPONSE without retrying', async () => {
    const fetchImpl = sequenceFetch(jsonResponse(okBody('   ')));
    const { client } = makeClient(fetchImpl);
    await expect(client.complete(history)).rejects.toMatchObject({ status: 502, code: 'AI_EMPTY_RESPONSE' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('treats missing choices as an empty response', async () => {
    const fetchImpl = sequenceFetch(jsonResponse({ choices: [] }));
    const { client } = makeClient(fetchImpl);
    await expect(client.complete(history)).rejects.toMatchObject({ code: 'AI_EMPTY_RESPONSE' });
  });

  it('handles an error object inside a 200 response', async () => {
    const fetchImpl = sequenceFetch(
      jsonResponse({ error: { message: 'upstream exploded', code: 502 } }),
      jsonResponse(okBody('recovered')),
    );
    const { client } = makeClient(fetchImpl);
    expect((await client.complete(history)).content).toBe('recovered');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('maps a 402 (insufficient credits) to AI_BAD_REQUEST without retrying', async () => {
    const fetchImpl = sequenceFetch(jsonResponse({ error: { message: 'Insufficient credits' } }, 402));
    const { client } = makeClient(fetchImpl);
    await expect(client.complete(history)).rejects.toMatchObject({ code: 'AI_BAD_REQUEST' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('buildContext', () => {
  const msg = (role, content) => ({ role, content });

  it('keeps chronological order', () => {
    const h = [msg('user', 'a'), msg('assistant', 'b'), msg('user', 'c')];
    expect(buildContext(h, 1000)).toEqual(h);
  });

  it('drops the oldest messages beyond the character budget', () => {
    const h = [msg('user', 'x'.repeat(600)), msg('assistant', 'y'.repeat(600)), msg('user', 'z'.repeat(600))];
    const ctx = buildContext(h, 1300);
    expect(ctx).toEqual([msg('user', 'z'.repeat(600))]);
  });

  it('always keeps the newest message even if it exceeds the budget', () => {
    const ctx = buildContext([msg('user', 'q'.repeat(5000))], 1000);
    expect(ctx).toHaveLength(1);
  });

  it('never starts the context with an assistant message', () => {
    const h = [msg('user', 'a'.repeat(900)), msg('assistant', 'b'), msg('user', 'c')];
    expect(buildContext(h, 100)).toEqual([msg('user', 'c')]);
    const h2 = [msg('assistant', 'welcome'), msg('user', 'hi')];
    expect(buildContext(h2, 1000)).toEqual([msg('user', 'hi')]);
  });
});
