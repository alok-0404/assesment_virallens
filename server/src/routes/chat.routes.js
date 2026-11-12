import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  sendMessageSchema,
  conversationIdParams,
  historyQuery,
  messagesQuery,
} from '../validators/chat.schemas.js';
import { createChatController } from '../controllers/chat.controller.js';

export function createChatRouter({ env, limiters, requireAuth, aiClient, inFlight }) {
  const router = Router();
  const controller = createChatController({ env, aiClient, inFlight });

  router.use(requireAuth);
  router.post('/send', limiters.chatLimiter, validate({ body: sendMessageSchema }), controller.send);
  router.get('/history', validate({ query: historyQuery }), controller.history);
  router.get('/conversations/:id', validate({ params: conversationIdParams }), controller.getConversation);
  router.get(
    '/conversations/:id/messages',
    validate({ params: conversationIdParams, query: messagesQuery }),
    controller.getMessages,
  );
  router.delete('/conversations/:id', validate({ params: conversationIdParams }), controller.remove);

  return router;
}
