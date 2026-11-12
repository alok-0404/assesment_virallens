import { randomUUID } from 'node:crypto';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';

// Every query in this module filters by `user`, which callers must take from req.user.id.

export const TITLE_MAX_LENGTH = 60;

const conversationNotFound = () => notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');

export function generateTitle(text) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'New conversation';
  return clean.length > TITLE_MAX_LENGTH ? `${clean.slice(0, TITLE_MAX_LENGTH).trimEnd()}…` : clean;
}

export function createConversation(userId, title) {
  return Conversation.create({ user: userId, title, lastMessageAt: new Date() });
}

export async function findOwnedConversation(userId, conversationId) {
  const conversation = await Conversation.findOne({ _id: conversationId, user: userId });
  if (!conversation) throw conversationNotFound();
  return conversation;
}

export async function listConversations(userId, { page, limit }) {
  const filter = { user: userId };
  const [conversations, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Conversation.countDocuments(filter),
  ]);
  return {
    conversations: conversations.map((c) => c.toJSON()),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

/** Cursor pagination: returns up to `limit` messages older than `before`, oldest first. */
export async function listMessages(userId, conversationId, { limit, before }) {
  await findOwnedConversation(userId, conversationId);

  const filter = { conversation: conversationId, user: userId };
  if (before) {
    const cursor = await Message.findOne({ _id: before, conversation: conversationId, user: userId })
      .select('createdAt')
      .lean();
    if (!cursor) throw badRequest('Invalid pagination cursor.', undefined, 'INVALID_CURSOR');
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
    ];
  }

  const docs = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1);
  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit).reverse();
  return {
    messages: page.map((m) => m.toJSON()),
    hasMore,
    nextCursor: hasMore && page.length ? page[0].id : null,
  };
}

/** Most recent `count` messages of a conversation in chronological order (for AI context). */
export async function getRecentMessages(userId, conversationId, count) {
  const docs = await Message.find({ conversation: conversationId, user: userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(count)
    .select('role content')
    .lean();
  return docs.reverse().map(({ role, content }) => ({ role, content }));
}

export function addMessage(userId, conversationId, fields) {
  return Message.create({ ...fields, user: userId, conversation: conversationId });
}

/** Updates last activity after a completed exchange; null if the conversation was deleted meanwhile. */
export function recordExchange(userId, conversationId, messagesAdded = 2) {
  return Conversation.findOneAndUpdate(
    { _id: conversationId, user: userId },
    { $set: { lastMessageAt: new Date() }, $inc: { messageCount: messagesAdded } },
    { returnDocument: 'after' },
  );
}

async function findCompletedExchange(userId, clientMessageId) {
  const userMessage = await Message.findOne({ user: userId, clientMessageId });
  if (!userMessage) return null;
  const [assistantMessage, conversation] = await Promise.all([
    Message.findOne({ user: userId, replyTo: userMessage._id }),
    Conversation.findOne({ _id: userMessage.conversation, user: userId }),
  ]);
  if (!assistantMessage || !conversation) return null;
  return {
    conversation: conversation.toJSON(),
    userMessage: userMessage.toJSON(),
    assistantMessage: assistantMessage.toJSON(),
  };
}

async function rollbackExchange(userId, conversation, userMessage, conversationCreated) {
  await Message.deleteOne({ _id: userMessage._id, user: userId });
  if (conversationCreated) {
    await Conversation.deleteOne({ _id: conversation._id, user: userId });
  }
}

/**
 * Persists the user's message, asks the AI for a reply with recent context and persists it.
 * On AI failure the user message (and a conversation created by this call) are rolled back.
 */
export async function sendMessage(userId, { message, conversationId, clientMessageId }, { aiClient, inFlight, env }) {
  const lockKey = conversationId
    ? `${userId}:${conversationId}`
    : `${userId}:new:${clientMessageId ?? randomUUID()}`;
  const release = inFlight.acquire(lockKey);
  if (!release) {
    throw conflict('REQUEST_IN_PROGRESS', 'A reply is already being generated for this conversation.');
  }

  try {
    if (clientMessageId) {
      const replay = await findCompletedExchange(userId, clientMessageId);
      if (replay) return { ...replay, replayed: true };
    }

    const conversationCreated = !conversationId;
    const conversation = conversationCreated
      ? await createConversation(userId, generateTitle(message))
      : await findOwnedConversation(userId, conversationId);

    let userMessage;
    try {
      userMessage = await addMessage(userId, conversation._id, {
        role: 'user',
        content: message,
        ...(clientMessageId && { clientMessageId }),
      });
    } catch (err) {
      if (conversationCreated) await Conversation.deleteOne({ _id: conversation._id, user: userId });
      if (err?.code === 11000) {
        throw conflict('DUPLICATE_REQUEST', 'This message has already been submitted.');
      }
      throw err;
    }

    let reply;
    try {
      const history = await getRecentMessages(userId, conversation._id, env.AI_CONTEXT_MESSAGES);
      reply = await aiClient.complete(history);
    } catch (err) {
      await rollbackExchange(userId, conversation, userMessage, conversationCreated);
      throw err;
    }

    const updatedConversation = await recordExchange(userId, conversation._id);
    if (!updatedConversation) {
      // Conversation was deleted while the reply was being generated.
      await Message.deleteMany({ conversation: conversation._id, user: userId });
      throw conversationNotFound();
    }

    const assistantMessage = await addMessage(userId, conversation._id, {
      role: 'assistant',
      content: reply.content,
      replyTo: userMessage._id,
      model: reply.model,
      usage: reply.usage,
    });

    return {
      conversation: updatedConversation.toJSON(),
      userMessage: userMessage.toJSON(),
      assistantMessage: assistantMessage.toJSON(),
      replayed: false,
    };
  } finally {
    release();
  }
}

export async function deleteConversation(userId, conversationId) {
  const conversation = await Conversation.findOneAndDelete({ _id: conversationId, user: userId });
  if (!conversation) throw conversationNotFound();
  const { deletedCount } = await Message.deleteMany({ conversation: conversationId, user: userId });
  return { id: conversation._id.toString(), deletedMessages: deletedCount };
}
