import { rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

function limiter({ windowMs, limit, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    handler: (req, res, next) => {
      next(new AppError(429, 'RATE_LIMITED', message));
    },
  });
}

export function createRateLimiters(env) {
  return {
    globalLimiter: limiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      message: 'Too many requests. Please slow down.',
    }),
    authLimiter: limiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.AUTH_RATE_LIMIT_MAX,
      message: 'Too many authentication attempts. Please try again later.',
    }),
    chatLimiter: limiter({
      windowMs: env.CHAT_RATE_LIMIT_WINDOW_MS,
      limit: env.CHAT_RATE_LIMIT_MAX,
      message: 'You are sending messages too quickly. Please wait a moment.',
      keyGenerator: (req) => `user:${req.user.id}`,
    }),
  };
}
