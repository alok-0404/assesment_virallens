import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

function normalizeError(err) {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', formatZodIssues(err));
  }
  if (err?.type === 'entity.parse.failed') {
    return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON.');
  }
  if (err?.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  }
  if (err instanceof mongoose.Error.CastError) {
    return new AppError(400, 'VALIDATION_ERROR', `Invalid value for "${err.path}".`);
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return new AppError(400, 'VALIDATION_ERROR', 'Data validation failed.', details);
  }
  if (err?.code === 11000) {
    return new AppError(409, 'DUPLICATE_KEY', 'Resource already exists.');
  }
  return null;
}

export function createErrorHandler(env) {
  // Express identifies error middleware by its four-parameter signature.
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    const appError =
      normalizeError(err) ?? new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');

    if (appError.status >= 500) {
      logger.error(`${req.method} ${req.originalUrl.split('?')[0]} ->`, err?.stack || err);
    }

    const error = { code: appError.code, message: appError.message };
    if (appError.details) error.details = appError.details;
    if (env.NODE_ENV === 'development' && appError.status >= 500 && err?.stack) {
      error.stack = err.stack;
    }

    if (appError.retryAfter) res.set('Retry-After', String(appError.retryAfter));
    res.status(appError.status).json({ success: false, error });
  };
}
