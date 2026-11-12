import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { AUTH_COOKIE } from '../utils/cookies.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { unauthorized } from '../utils/AppError.js';

/** The only place req.user is set: from a verified JWT whose subject still exists. */
export function createRequireAuth(env) {
  return async function requireAuth(req, res, next) {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) throw unauthorized();

    let payload;
    try {
      payload = verifyAccessToken(token, env);
    } catch {
      throw unauthorized('Your session is invalid or has expired. Please log in again.');
    }

    if (typeof payload?.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
      throw unauthorized('Your session is invalid. Please log in again.');
    }

    const user = await User.findById(payload.sub).lean();
    if (!user) throw unauthorized('Your session is invalid. Please log in again.');

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
    next();
  };
}
