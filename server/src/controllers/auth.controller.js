import { registerUser, authenticateUser } from '../services/auth.service.js';
import { signAccessToken } from '../utils/jwt.js';
import { setAuthCookie, clearAuthCookie } from '../utils/cookies.js';
import { sendSuccess } from '../utils/apiResponse.js';

export function createAuthController(env) {
  return {
    async signup(req, res) {
      const user = await registerUser(req.validated.body, env);
      setAuthCookie(res, signAccessToken(user._id, env), env);
      return sendSuccess(res, { user: user.toJSON() }, 201);
    },

    async login(req, res) {
      const user = await authenticateUser(req.validated.body, env);
      setAuthCookie(res, signAccessToken(user._id, env), env);
      return sendSuccess(res, { user: user.toJSON() });
    },

    logout(req, res) {
      clearAuthCookie(res, env);
      return sendSuccess(res, { loggedOut: true });
    },

    me(req, res) {
      return sendSuccess(res, { user: req.user });
    },
  };
}
