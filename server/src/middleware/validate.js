import { AppError } from '../utils/AppError.js';
import { formatZodIssues } from './errorHandler.js';

/**
 * Validates req.params / req.query / req.body against Zod schemas.
 * Parsed (coerced, trimmed) values are exposed on req.validated.
 */
export function validate(schemas) {
  return (req, res, next) => {
    req.validated = req.validated ?? {};
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return next(
          new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', formatZodIssues(result.error)),
        );
      }
      req.validated[part] = result.data;
    }
    return next();
  };
}
