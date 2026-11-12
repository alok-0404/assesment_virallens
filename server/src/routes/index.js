import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { createAuthRouter } from './auth.routes.js';
import { createChatRouter } from './chat.routes.js';

export function createApiRouter(deps) {
  const router = Router();
  router.use('/health', healthRoutes);
  router.use('/auth', createAuthRouter(deps));
  router.use('/chat', createChatRouter(deps));
  return router;
}
