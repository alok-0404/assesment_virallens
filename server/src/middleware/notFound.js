import { notFound as notFoundError } from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(notFoundError('NOT_FOUND', `Route ${req.method} ${req.path} not found.`));
}
