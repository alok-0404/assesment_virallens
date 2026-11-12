export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export const badRequest = (message, details, code = 'VALIDATION_ERROR') =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'Authentication required.') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (code, message) => new AppError(403, code, message);
export const notFound = (code = 'NOT_FOUND', message = 'Resource not found.') =>
  new AppError(404, code, message);
export const conflict = (code, message) => new AppError(409, code, message);
