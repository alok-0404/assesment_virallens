import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { signupSchema, loginSchema } from '../validators/auth.schemas.js';
import { createAuthController } from '../controllers/auth.controller.js';

export function createAuthRouter({ env, limiters, requireAuth, csrf }) {
  const router = Router();
  const controller = createAuthController(env);

  router.get('/csrf-token', csrf.issueCsrfToken);
  router.post('/signup', limiters.authLimiter, validate({ body: signupSchema }), controller.signup);
  router.post('/login', limiters.authLimiter, validate({ body: loginSchema }), controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuth, controller.me);

  return router;
}
