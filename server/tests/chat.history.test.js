import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { testEnv } from './helpers/env.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './helpers/db.js';
import { signedInAgent } from './helpers/agent.js';

const aiClient = {
  complete: vi.fn(async (history) => ({ content: `Answer: ${history.at(-1).content}`, model: 'm' })),
};
const app = createApp(testEnv(), { aiClient });

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function startConversation(client, message) {
  const res = await client.post('/api/chat/send', { message });
  expect(res.status).toBe(201);
  return res.body.data.conversation;
}

describe('GET /api/chat/history', () => {
  it('returns only the caller\'s conversations, most recent first', async () => {
    const alice = await signedInAgent(app);
    const bob = await signedInAgent(app);
    const a1 = await startConversation(alice, 'Alice first');
    const a2 = await startConversation(alice, 'Alice second');
    const b1 = await startConversation(bob, 'Bob only');

    const aliceHistory = await alice.get('/api/chat/history');
    expect(aliceHistory.status).toBe(200);
    expect(aliceHistory.body.data.conversations.map((c) => c.id)).toEqual([a2.id, a1.id]);
    expect(aliceHistory.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1, hasMore: false });

    const bobHistory = await bob.get('/api/chat/history');
    expect(bobHistory.body.data.conversations.map((c) => c.id)).toEqual([b1.id]);
  });

  it('moves a continued conversation to the top', async () => {
    const alice = await signedInAgent(app);
    const older = await startConversation(alice, 'older');
    const newer = await startConversation(alice, 'newer');
    await alice.post('/api/chat/send', { message: 'bump', conversationId: older.id });

    const res = await alice.get('/api/chat/history');
    expect(res.body.data.conversations.map((c) => c.id)).toEqual([older.id, newer.id]);
  });

  it('paginates with page and limit', async () => {
    const alice = await signedInAgent(app);
    for (let i = 0; i < 3; i += 1) await startConversation(alice, `c${i}`);

    const page1 = await alice.get('/api/chat/history?page=1&limit=2');
    expect(page1.body.data.conversations).toHaveLength(2);
    expect(page1.body.meta).toMatchObject({ total: 3, totalPages: 2, hasMore: true });

    const page2 = await alice.get('/api/chat/history?page=2&limit=2');
    expect(page2.body.data.conversations.map((c) => c.title)).toEqual(['c0']);
    expect(page2.body.meta.hasMore).toBe(false);
  });

  it.each(['page=0', 'limit=0', 'limit=51', 'page=abc'])('rejects invalid query %s', async (qs) => {
    const alice = await signedInAgent(app);
    const res = await alice.get(`/api/chat/history?${qs}`);
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/chat/history');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/chat/conversations/:id', () => {
  it('returns an owned conversation', async () => {
    const alice = await signedInAgent(app);
    const conv = await startConversation(alice, 'Mine');
    const res = await alice.get(`/api/chat/conversations/${conv.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.conversation).toMatchObject({ id: conv.id, title: 'Mine', messageCount: 2 });
  });

  it('blocks access to another user\'s conversation with 404', async () => {
    const alice = await signedInAgent(app);
    const bob = await signedInAgent(app);
    const conv = await startConversation(alice, 'Secret');
    const res = await bob.get(`/api/chat/conversations/${conv.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONVERSATION_NOT_FOUND');
    expect(JSON.stringify(res.body)).not.toContain('Secret');
  });

  it('rejects an invalid id with 400', async () => {
    const alice = await signedInAgent(app);
    const res = await alice.get('/api/chat/conversations/123');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/chat/conversations/:id/messages', () => {
  it('returns messages in chronological order', async () => {
    const alice = await signedInAgent(app);
    const conv = await startConversation(alice, 'Q1');
    await alice.post('/api/chat/send', { message: 'Q2', conversationId: conv.id });

    const res = await alice.get(`/api/chat/conversations/${conv.id}/messages`);
    expect(res.status).toBe(200);
    expect(res.body.data.messages.map((m) => `${m.role}:${m.content}`)).toEqual([
      'user:Q1',
      'assistant:Answer: Q1',
      'user:Q2',
      'assistant:Answer: Q2',
    ]);
    expect(res.body.data).toMatchObject({ hasMore: false, nextCursor: null });
  });

  it('supports cursor pagination', async () => {
    const alice = await signedInAgent(app);
    const conv = await startConversation(alice, 'Q1');
    await alice.post('/api/chat/send', { message: 'Q2', conversationId: conv.id });

    const latest = await alice.get(`/api/chat/conversations/${conv.id}/messages?limit=3`);
    expect(latest.body.data.messages.map((m) => m.content)).toEqual(['Answer: Q1', 'Q2', 'Answer: Q2']);
    expect(latest.body.data.hasMore).toBe(true);

    const older = await alice.get(
      `/api/chat/conversations/${conv.id}/messages?limit=3&before=${latest.body.data.nextCursor}`,
    );
    expect(older.body.data.messages.map((m) => m.content)).toEqual(['Q1']);
    expect(older.body.data.hasMore).toBe(false);
  });

  it('blocks another user from reading messages', async () => {
    const alice = await signedInAgent(app);
    const bob = await signedInAgent(app);
    const conv = await startConversation(alice, 'private message');
    const res = await bob.get(`/api/chat/conversations/${conv.id}/messages`);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('private message');
  });

  it('rejects a cursor that does not belong to the conversation', async () => {
    const alice = await signedInAgent(app);
    const c1 = await startConversation(alice, 'one');
    await startConversation(alice, 'two');
    const foreign = await Message.findOne({ content: 'two' }).lean();
    const res = await alice.get(`/api/chat/conversations/${c1.id}/messages?before=${foreign._id}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURSOR');
  });

  it('rejects an out-of-range limit', async () => {
    const alice = await signedInAgent(app);
    const conv = await startConversation(alice, 'x');
    const res = await alice.get(`/api/chat/conversations/${conv.id}/messages?limit=500`);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/chat/conversations/:id', () => {
  it('deletes an owned conversation and its messages', async () => {
    const alice = await signedInAgent(app);
    const conv = await startConversation(alice, 'to delete');
    const keep = await startConversation(alice, 'to keep');

    const res = await alice.del(`/api/chat/conversations/${conv.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: conv.id, deletedMessages: 2 });

    expect(await Conversation.exists({ _id: conv.id })).toBeNull();
    expect(await Message.countDocuments({ conversation: conv.id })).toBe(0);
    const history = await alice.get('/api/chat/history');
    expect(history.body.data.conversations.map((c) => c.id)).toEqual([keep.id]);

    const again = await alice.del(`/api/chat/conversations/${conv.id}`);
    expect(again.status).toBe(404);
  });

  it('blocks deletion of another user\'s conversation and keeps their data', async () => {
    const alice = await signedInAgent(app);
    const bob = await signedInAgent(app);
    const conv = await startConversation(alice, 'alice data');

    const res = await bob.del(`/api/chat/conversations/${conv.id}`);
    expect(res.status).toBe(404);
    expect(await Conversation.exists({ _id: conv.id })).not.toBeNull();
    expect(await Message.countDocuments({ conversation: conv.id })).toBe(2);
  });

  it('requires a CSRF token', async () => {
    const alice = await signedInAgent(app);
    const conv = await startConversation(alice, 'csrf');
    const res = await alice.agent.delete(`/api/chat/conversations/${conv.id}`);
    expect(res.status).toBe(403);
    expect(await Conversation.exists({ _id: conv.id })).not.toBeNull();
  });

  it('returns 404 for an unknown id and 400 for an invalid id', async () => {
    const alice = await signedInAgent(app);
    expect((await alice.del(`/api/chat/conversations/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
    expect((await alice.del('/api/chat/conversations/nope')).status).toBe(400);
  });
});
