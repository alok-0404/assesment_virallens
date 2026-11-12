import { http } from './http.js';

// Server-side AI calls may retry with backoff; allow for that before giving up.
const SEND_TIMEOUT_MS = 120000;

export const chatApi = {
  sendMessage: ({ message, conversationId, clientMessageId }) =>
    http
      .post(
        '/chat/send',
        { message, clientMessageId, ...(conversationId && { conversationId }) },
        { timeout: SEND_TIMEOUT_MS },
      )
      .then((res) => res.data.data),

  getHistory: ({ page = 1, limit = 20 } = {}) =>
    http
      .get('/chat/history', { params: { page, limit } })
      .then((res) => ({ conversations: res.data.data.conversations, meta: res.data.meta })),

  getConversation: (id, { signal } = {}) =>
    http.get(`/chat/conversations/${id}`, { signal }).then((res) => res.data.data.conversation),

  getMessages: (id, { before, limit = 50, signal } = {}) =>
    http
      .get(`/chat/conversations/${id}/messages`, { params: { before, limit }, signal })
      .then((res) => res.data.data),

  deleteConversation: (id) => http.delete(`/chat/conversations/${id}`).then((res) => res.data.data),
};
