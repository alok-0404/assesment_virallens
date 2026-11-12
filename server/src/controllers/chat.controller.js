import {
  sendMessage,
  listConversations,
  findOwnedConversation,
  listMessages,
  deleteConversation,
} from '../services/chat.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export function createChatController({ env, aiClient, inFlight }) {
  return {
    async send(req, res) {
      const { replayed, ...data } = await sendMessage(req.user.id, req.validated.body, {
        env,
        aiClient,
        inFlight,
      });
      return sendSuccess(res, data, replayed ? 200 : 201);
    },

    async history(req, res) {
      const { conversations, meta } = await listConversations(req.user.id, req.validated.query);
      return sendSuccess(res, { conversations }, 200, meta);
    },

    async getConversation(req, res) {
      const conversation = await findOwnedConversation(req.user.id, req.validated.params.id);
      return sendSuccess(res, { conversation: conversation.toJSON() });
    },

    async getMessages(req, res) {
      const data = await listMessages(req.user.id, req.validated.params.id, req.validated.query);
      return sendSuccess(res, data);
    },

    async remove(req, res) {
      const result = await deleteConversation(req.user.id, req.validated.params.id);
      return sendSuccess(res, result);
    },
  };
}
