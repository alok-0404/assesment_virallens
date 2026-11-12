import jwt from 'jsonwebtoken';

export function signAccessToken(userId, env) {
  return jwt.sign({ sub: String(userId) }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function verifyAccessToken(token, env) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
}
