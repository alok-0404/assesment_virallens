import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import * as chat from '../src/services/chat.service.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from './helpers/db.js';

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(clearTestDb);

async function makeUser(n = 1) {
  return User.create({ name: `User ${n}`, email: `u${n}_${Date.now()}@example.com`, passwordHash: 'x' });
}

async function seedMessages(userId, conversationId, count) {
  const ids = [];
  for (let i = 0; i < count; i += 1) {
    const m = await chat.addMessage(userId, conversationId, {
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    });
    ids.push(m.id);
  }
  return ids;
}

describe('generateTitle', () => {
  it('collapses whitespace and keeps short text intact', () => {
    expect(chat.generateTitle('  Where is\n\n my   order? ')).toBe('Where is my order?');
  });
  it('truncates long text with an ellipsis', () => {
    const title = chat.generateTitle('a'.repeat(100));
    expect(title).toHaveLength(61);
    expect(title.endsWith('…')).toBe(true);
  });
  it('falls back for empty text', () => {
    expect(chat.generateTitle('   ')).toBe('New conversation');
  });
});

describe('models', () => {
  it('creates conversations and messages with public JSON shapes', async () => {
    const user = await makeUser();
    const conversation = await chat.createConversation(user._id, 'Hello');
    const message = await chat.addMessage(user._id, conversation._id, {
      role: 'user',
      content: 'Hi',
      clientMessageId: 'client-123',
    });

    expect(conversation.toJSON()).toEqual({
      id: conversation.id,
      title: 'Hello',
      lastMessageAt: expect.any(Date),
      messageCount: 0,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(message.toJSON()).toEqual({
      id: message.id,
      conversationId: conversation.id,
      role: 'user',
      content: 'Hi',
      clientMessageId: 'client-123',
      createdAt: expect.any(Date),
    });
    expect(JSON.stringify(message.toJSON())).not.toContain(user.id);
  });

  it('rejects invalid roles and missing content', async () => {
    const user = await makeUser();
    const conversation = await chat.createConversation(user._id, 'x');
    await expect(chat.addMessage(user._id, conversation._id, { role: 'system', content: 'x' })).rejects.toThrow();
    await expect(chat.addMessage(user._id, conversation._id, { role: 'user' })).rejects.toThrow();
  });

  it('defines the documented indexes', async () => {
    const convIndexes = await Conversation.collection.indexes();
    expect(convIndexes.map((i) => i.key)).toContainEqual({ user: 1, lastMessageAt: -1 });

    const msgIndexes = await Message.collection.indexes();
    const keys = msgIndexes.map((i) => i.key);
    expect(keys).toContainEqual({ conversation: 1, createdAt: 1, _id: 1 });
    expect(keys).toContainEqual({ user: 1, conversation: 1 });
    const idem = msgIndexes.find((i) => i.key.clientMessageId === 1);
    expect(idem.unique).toBe(true);

    const userIndexes = await User.collection.indexes();
    expect(userIndexes.find((i) => i.key.email === 1).unique).toBe(true);
  });

  it('enforces unique clientMessageId per user but allows it across users', async () => {
    const a = await makeUser(1);
    const b = await makeUser(2);
    const convA = await chat.createConversation(a._id, 'a');
    const convB = await chat.createConversation(b._id, 'b');
    await chat.addMessage(a._id, convA._id, { role: 'user', content: 'x', clientMessageId: 'same-id' });
    await expect(
      chat.addMessage(a._id, convA._id, { role: 'user', content: 'y', clientMessageId: 'same-id' }),
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      chat.addMessage(b._id, convB._id, { role: 'user', content: 'z', clientMessageId: 'same-id' }),
    ).resolves.toBeDefined();
    // Messages without a clientMessageId never collide.
    await chat.addMessage(a._id, convA._id, { role: 'assistant', content: '1' });
    await chat.addMessage(a._id, convA._id, { role: 'assistant', content: '2' });
  });
});

describe('chat service ownership and ordering', () => {
  it('finds only conversations owned by the user', async () => {
    const a = await makeUser(1);
    const b = await makeUser(2);
    const conv = await chat.createConversation(a._id, 'private');

    await expect(chat.findOwnedConversation(a._id, conv._id)).resolves.toMatchObject({ title: 'private' });
    await expect(chat.findOwnedConversation(b._id, conv._id)).rejects.toMatchObject({
      status: 404,
      code: 'CONVERSATION_NOT_FOUND',
    });
  });

  it('returns messages in chronological order and recent context', async () => {
    const user = await makeUser();
    const conv = await chat.createConversation(user._id, 't');
    await seedMessages(user._id, conv._id, 5);

    const { messages, hasMore } = await chat.listMessages(user._id, conv._id, { limit: 50 });
    expect(messages.map((m) => m.content)).toEqual([0, 1, 2, 3, 4].map((i) => `message ${i}`));
    expect(hasMore).toBe(false);

    const recent = await chat.getRecentMessages(user._id, conv._id, 3);
    expect(recent).toEqual([
      { role: 'user', content: 'message 2' },
      { role: 'assistant', content: 'message 3' },
      { role: 'user', content: 'message 4' },
    ]);
  });

  it('paginates messages with a cursor', async () => {
    const user = await makeUser();
    const conv = await chat.createConversation(user._id, 't');
    await seedMessages(user._id, conv._id, 7);

    const first = await chat.listMessages(user._id, conv._id, { limit: 3 });
    expect(first.messages.map((m) => m.content)).toEqual(['message 4', 'message 5', 'message 6']);
    expect(first.hasMore).toBe(true);

    const second = await chat.listMessages(user._id, conv._id, { limit: 3, before: first.nextCursor });
    expect(second.messages.map((m) => m.content)).toEqual(['message 1', 'message 2', 'message 3']);

    const third = await chat.listMessages(user._id, conv._id, { limit: 3, before: second.nextCursor });
    expect(third.messages.map((m) => m.content)).toEqual(['message 0']);
    expect(third.hasMore).toBe(false);
    expect(third.nextCursor).toBeNull();
  });

  it('rejects a cursor from another conversation', async () => {
    const user = await makeUser();
    const c1 = await chat.createConversation(user._id, '1');
    const c2 = await chat.createConversation(user._id, '2');
    const [otherId] = await seedMessages(user._id, c2._id, 1);
    await expect(chat.listMessages(user._id, c1._id, { limit: 10, before: otherId })).rejects.toMatchObject({
      code: 'INVALID_CURSOR',
    });
  });

  it('lists conversations by last activity with page metadata', async () => {
    const a = await makeUser(1);
    const b = await makeUser(2);
    const older = await chat.createConversation(a._id, 'older');
    const newer = await chat.createConversation(a._id, 'newer');
    await chat.createConversation(b._id, 'not mine');
    await chat.recordExchange(a._id, older._id);

    const page1 = await chat.listConversations(a._id, { page: 1, limit: 1 });
    expect(page1.conversations.map((c) => c.title)).toEqual(['older']);
    expect(page1.conversations[0].messageCount).toBe(2);
    expect(page1.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2, hasMore: true });

    const page2 = await chat.listConversations(a._id, { page: 2, limit: 1 });
    expect(page2.conversations.map((c) => c.id)).toEqual([newer.id]);
    expect(page2.meta.hasMore).toBe(false);

    const beyond = await chat.listConversations(a._id, { page: 5, limit: 1 });
    expect(beyond.conversations).toEqual([]);
  });

  it('recordExchange updates last activity and ignores other users', async () => {
    const a = await makeUser(1);
    const b = await makeUser(2);
    const conv = await chat.createConversation(a._id, 't');
    const before = conv.lastMessageAt.getTime();
    await new Promise((r) => setTimeout(r, 5));

    expect(await chat.recordExchange(b._id, conv._id)).toBeNull();
    const updated = await chat.recordExchange(a._id, conv._id);
    expect(updated.lastMessageAt.getTime()).toBeGreaterThan(before);
    expect(updated.messageCount).toBe(2);
  });

  it('deletes a conversation with its messages, only for the owner', async () => {
    const a = await makeUser(1);
    const b = await makeUser(2);
    const conv = await chat.createConversation(a._id, 't');
    await seedMessages(a._id, conv._id, 4);

    await expect(chat.deleteConversation(b._id, conv._id)).rejects.toMatchObject({ status: 404 });
    expect(await Message.countDocuments({ conversation: conv._id })).toBe(4);

    const result = await chat.deleteConversation(a._id, conv._id);
    expect(result).toEqual({ id: conv.id, deletedMessages: 4 });
    expect(await Conversation.exists({ _id: conv._id })).toBeNull();
    expect(await Message.countDocuments({ conversation: conv._id })).toBe(0);
  });

  it('never lists another user\'s messages even with a known conversation id', async () => {
    const a = await makeUser(1);
    const b = await makeUser(2);
    const conv = await chat.createConversation(a._id, 't');
    await seedMessages(a._id, conv._id, 2);
    await expect(chat.listMessages(b._id, conv._id, { limit: 10 })).rejects.toMatchObject({ status: 404 });
    expect(await chat.getRecentMessages(b._id, conv._id, 10)).toEqual([]);
    expect(mongoose.isValidObjectId(conv.id)).toBe(true);
  });
});
