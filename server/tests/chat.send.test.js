import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { createOpenRouterClient, DEFAULT_SYSTEM_PROMPT } from '../src/services/openrouter.service.js';
import { AppError } from '../src/utils/AppError.js';
import { testEnv } from './helpers/env.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './helpers/db.js';
import { signedInAgent } from './helpers/agent.js';

const env = testEnv();

function fakeAi(impl) {
  return {
    complete: vi.fn(
      impl ??
        (async (history) => ({
          content: `Reply to: ${history.at(-1).content}`,
          model: 'test/model',
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        })),
    ),
  };
}

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

describe('POST /api/chat/send', () => {
  it('requires authentication', async () => {
    const app = createApp(env, { aiClient: fakeAi() });
    const res = await request(app).post('/api/chat/send').send({ message: 'hi' });
    // CSRF is checked first for anonymous mutating requests; with a token, auth fails.
    expect([401, 403]).toContain(res.status);

    const { agent, csrfToken } = await (await import('./helpers/agent.js')).createAgent(app);
    const authRes = await agent.post('/api/chat/send').set('X-CSRF-Token', csrfToken).send({ message: 'hi' });
    expect(authRes.status).toBe(401);
  });

  it('creates a conversation titled from the first message and stores both messages', async () => {
    const ai = fakeAi();
    const app = createApp(env, { aiClient: ai });
    const client = await signedInAgent(app);

    const res = await client.post('/api/chat/send', {
      message: '  Where is my order #123?  ',
      clientMessageId: 'client-msg-0001',
    });

    expect(res.status).toBe(201);
    const { conversation, userMessage, assistantMessage } = res.body.data;
    expect(conversation).toMatchObject({ title: 'Where is my order #123?', messageCount: 2 });
    expect(userMessage).toMatchObject({
      role: 'user',
      content: 'Where is my order #123?',
      conversationId: conversation.id,
      clientMessageId: 'client-msg-0001',
    });
    expect(assistantMessage).toMatchObject({
      role: 'assistant',
      content: 'Reply to: Where is my order #123?',
      conversationId: conversation.id,
      replyTo: userMessage.id,
      model: 'test/model',
    });

    const stored = await Message.find({ conversation: conversation.id }).sort({ createdAt: 1 }).lean();
    expect(stored.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(stored.every((m) => m.user.toString() === client.user.id)).toBe(true);
    expect(ai.complete).toHaveBeenCalledWith([{ role: 'user', content: 'Where is my order #123?' }]);
  });

  it('continues an existing conversation with ordered context', async () => {
    const ai = fakeAi();
    const app = createApp(env, { aiClient: ai });
    const client = await signedInAgent(app);

    const first = await client.post('/api/chat/send', { message: 'First question' });
    const conversationId = first.body.data.conversation.id;
    const second = await client.post('/api/chat/send', { message: 'Follow-up', conversationId });

    expect(second.status).toBe(201);
    expect(second.body.data.conversation).toMatchObject({ id: conversationId, messageCount: 4 });
    expect(ai.complete).toHaveBeenLastCalledWith([
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'Reply to: First question' },
      { role: 'user', content: 'Follow-up' },
    ]);
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it('limits context to AI_CONTEXT_MESSAGES', async () => {
    const ai = fakeAi();
    const app = createApp(testEnv({ AI_CONTEXT_MESSAGES: '3' }), { aiClient: ai });
    const client = await signedInAgent(app);
    const first = await client.post('/api/chat/send', { message: 'one' });
    const conversationId = first.body.data.conversation.id;
    await client.post('/api/chat/send', { message: 'two', conversationId });
    await client.post('/api/chat/send', { message: 'three', conversationId });
    expect(ai.complete.mock.calls.at(-1)[0]).toEqual([
      { role: 'user', content: 'two' },
      { role: 'assistant', content: 'Reply to: two' },
      { role: 'user', content: 'three' },
    ]);
  });

  it('sends system prompt + context through the real OpenRouter client (fetch mocked)', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ model: 'm', choices: [{ message: { content: 'Happy to help!' } }] }), {
        status: 200,
      }),
    );
    const app = createApp(env, { aiClient: createOpenRouterClient(env, { fetchImpl }) });
    const client = await signedInAgent(app);
    const res = await client.post('/api/chat/send', { message: 'Refund status?' });
    expect(res.status).toBe(201);
    expect(res.body.data.assistantMessage.content).toBe('Happy to help!');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
      { role: 'user', content: 'Refund status?' },
    ]);
  });

  it('maps provider auth failures to a safe 502 without leaking the key', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":{"message":"bad key"}}', { status: 401 }));
    const app = createApp(env, { aiClient: createOpenRouterClient(env, { fetchImpl }) });
    const client = await signedInAgent(app);
    const res = await client.post('/api/chat/send', { message: 'hello' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_AUTH_ERROR');
    expect(JSON.stringify(res.body)).not.toContain(env.OPENROUTER_API_KEY);
    expect(JSON.stringify(res.body)).not.toContain('bad key');
  });

  it('rolls back a new conversation when the AI fails', async () => {
    const ai = fakeAi(async () => {
      throw new AppError(504, 'AI_TIMEOUT', 'AI service timed out. Please try again.');
    });
    const app = createApp(env, { aiClient: ai });
    const client = await signedInAgent(app);

    const res = await client.post('/api/chat/send', { message: 'hello', clientMessageId: 'retry-me-123' });
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('AI_TIMEOUT');
    expect(await Conversation.countDocuments()).toBe(0);
    expect(await Message.countDocuments()).toBe(0);

    // Retrying with the same clientMessageId works once the AI recovers.
    ai.complete.mockImplementation(async () => ({ content: 'ok now', model: 'm' }));
    const retry = await client.post('/api/chat/send', { message: 'hello', clientMessageId: 'retry-me-123' });
    expect(retry.status).toBe(201);
    expect(retry.body.data.assistantMessage.content).toBe('ok now');
  });

  it('rolls back only the new user message in an existing conversation', async () => {
    const ai = fakeAi();
    const app = createApp(env, { aiClient: ai });
    const client = await signedInAgent(app);
    const first = await client.post('/api/chat/send', { message: 'first' });
    const conversationId = first.body.data.conversation.id;

    ai.complete.mockRejectedValueOnce(new AppError(503, 'AI_RATE_LIMITED', 'busy'));
    const res = await client.post('/api/chat/send', { message: 'second', conversationId });
    expect(res.status).toBe(503);

    const conv = await Conversation.findById(conversationId).lean();
    expect(conv.messageCount).toBe(2);
    expect(await Message.countDocuments({ conversation: conversationId })).toBe(2);
  });

  it('replays a completed exchange for a repeated clientMessageId without calling the AI again', async () => {
    const ai = fakeAi();
    const app = createApp(env, { aiClient: ai });
    const client = await signedInAgent(app);
    const body = { message: 'Duplicate?', clientMessageId: 'dup-check-0001' };

    const first = await client.post('/api/chat/send', body);
    const second = await client.post('/api/chat/send', body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.userMessage.id).toBe(first.body.data.userMessage.id);
    expect(second.body.data.assistantMessage.id).toBe(first.body.data.assistantMessage.id);
    expect(ai.complete).toHaveBeenCalledTimes(1);
    expect(await Message.countDocuments()).toBe(2);
  });

  it('rejects a concurrent send to the same conversation with 409', async () => {
    let releaseAi;
    const gate = new Promise((resolve) => {
      releaseAi = resolve;
    });
    const ai = fakeAi();
    const app = createApp(env, { aiClient: ai });
    const client = await signedInAgent(app);
    const first = await client.post('/api/chat/send', { message: 'start' });
    const conversationId = first.body.data.conversation.id;

    ai.complete.mockImplementationOnce(async () => {
      await gate;
      return { content: 'slow reply', model: 'm' };
    });
    // Supertest requests are lazy; .then() dispatches it without awaiting the response.
    const slow = client.post('/api/chat/send', { message: 'slow', conversationId }).then((r) => r);
    await vi.waitFor(() => expect(ai.complete).toHaveBeenCalledTimes(2));

    const concurrent = await client.post('/api/chat/send', { message: 'fast', conversationId });
    expect(concurrent.status).toBe(409);
    expect(concurrent.body.error.code).toBe('REQUEST_IN_PROGRESS');

    releaseAi();
    expect((await slow).status).toBe(201);
    expect(await Message.countDocuments({ conversation: conversationId })).toBe(4);
  });

  it('returns 404 when sending into another user\'s conversation', async () => {
    const ai = fakeAi();
    const app = createApp(env, { aiClient: ai });
    const alice = await signedInAgent(app);
    const bob = await signedInAgent(app);
    const aliceConv = await alice.post('/api/chat/send', { message: 'private' });
    const conversationId = aliceConv.body.data.conversation.id;

    const res = await bob.post('/api/chat/send', { message: 'intrude', conversationId });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONVERSATION_NOT_FOUND');
    expect(await Message.countDocuments({ conversation: conversationId })).toBe(2);
    expect(ai.complete).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for a non-existent conversation id', async () => {
    const app = createApp(env, { aiClient: fakeAi() });
    const client = await signedInAgent(app);
    const res = await client.post('/api/chat/send', {
      message: 'x',
      conversationId: new mongoose.Types.ObjectId().toString(),
    });
    expect(res.status).toBe(404);
  });

  it.each([
    [{ message: '' }, 'message'],
    [{ message: '    ' }, 'message'],
    [{ message: 'x'.repeat(4001) }, 'message'],
    [{ message: 'hi', conversationId: 'not-an-id' }, 'conversationId'],
    [{ message: 'hi', clientMessageId: 'bad id!' }, 'clientMessageId'],
    [{ message: { $gt: '' } }, 'message'],
    [{ message: 'hi', userId: 'someone-else' }, ''],
  ])('validates the body %#', async (body, path) => {
    const ai = fakeAi();
    const app = createApp(env, { aiClient: ai });
    const client = await signedInAgent(app);
    const res = await client.post('/api/chat/send', body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.path)).toContain(path);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('applies the per-user chat rate limit', async () => {
    const app = createApp(testEnv({ CHAT_RATE_LIMIT_MAX: '2' }), { aiClient: fakeAi() });
    const client = await signedInAgent(app);
    await client.post('/api/chat/send', { message: 'one' });
    await client.post('/api/chat/send', { message: 'two' });
    const res = await client.post('/api/chat/send', { message: 'three' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');

    const other = await signedInAgent(app);
    expect((await other.post('/api/chat/send', { message: 'mine' })).status).toBe(201);
  });
});
