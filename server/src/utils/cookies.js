export const AUTH_COOKIE = 'access_token';
export const CSRF_COOKIE = 'csrf_token';

function baseOptions(env) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
  };
}

export function setAuthCookie(res, token, env) {
  res.cookie(AUTH_COOKIE, token, { ...baseOptions(env), maxAge: env.JWT_EXPIRES_MS });
}

export function clearAuthCookie(res, env) {
  res.clearCookie(AUTH_COOKIE, baseOptions(env));
}

export function setCsrfCookie(res, token, env) {
  res.cookie(CSRF_COOKIE, token, baseOptions(env));
}
