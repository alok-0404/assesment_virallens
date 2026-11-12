import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createApiRouter } from './routes/index.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { createRateLimiters } from './middleware/rateLimiters.js';
import { createCsrf } from './middleware/csrf.js';
import { createRequireAuth } from './middleware/auth.js';
import { createOpenRouterClient } from './services/openrouter.service.js';
import { createInFlightRegistry } from './utils/inFlight.js';
import { AppError } from './utils/AppError.js';

/**
 * Builds the Express application without connecting to the database or listening,
 * so it can be exercised directly by Supertest. Tests may inject `aiClient`.
 */
export function createApp(env, { aiClient = createOpenRouterClient(env) } = {}) {
  const app = express();
  const limiters = createRateLimiters(env);
  const csrf = createCsrf(env);
  const requireAuth = createRequireAuth(env);
  const inFlight = createInFlightRegistry();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  // First, so requests rejected by CORS or the body parser are still logged.
  if (!env.isTest) app.use(requestLogger);
  // API responses are per-user; forbid caching by browsers and by CDNs in front of the API (Vercel rewrites).
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.CLIENT_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new AppError(403, 'CORS_FORBIDDEN', 'Origin not allowed.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', limiters.globalLimiter);
  app.use('/api', csrf.requireCsrf);
  app.use('/api', createApiRouter({ env, limiters, requireAuth, csrf, aiClient, inFlight }));

  app.use(notFound);
  app.use(createErrorHandler(env));

  return app;
}
