import { randomBytes, timingSafeEqual } from 'node:crypto';
import { CSRF_COOKIE, setCsrfCookie } from '../utils/cookies.js';
import { forbidden } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function tokensMatch(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Double-submit CSRF protection: the token lives in an HttpOnly cookie and is
 * handed to the SPA in a response body that cross-origin pages cannot read.
 */
export function createCsrf(env) {
  function issueCsrfToken(req, res) {
    const existing = req.cookies?.[CSRF_COOKIE];
    const token = TOKEN_PATTERN.test(existing ?? '') ? existing : randomBytes(32).toString('hex');
    setCsrfCookie(res, token, env);
    res.set('Cache-Control', 'no-store');
    return sendSuccess(res, { csrfToken: token });
  }

  function requireCsrf(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();
    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.get('x-csrf-token');
    if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
      return next(forbidden('CSRF_INVALID', 'Invalid or missing CSRF token. Please refresh and try again.'));
    }
    return next();
  }

  return { issueCsrfToken, requireCsrf };
}
