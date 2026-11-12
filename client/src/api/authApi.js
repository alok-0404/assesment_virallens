import { http } from './http.js';

// Auth endpoints handle their own 401s (e.g. wrong password, anonymous visitor).
const options = { skipAuthHandler: true };

export const authApi = {
  me: () => http.get('/auth/me', options).then((res) => res.data.data.user),

  login: (email, password) =>
    http.post('/auth/login', { email, password }, options).then((res) => res.data.data.user),

  signup: ({ name, email, password }) =>
    http.post('/auth/signup', { name, email, password }, options).then((res) => res.data.data.user),

  // The JSON body must be an object: `null` serialises to "null", which strict express.json rejects.
  logout: () => http.post('/auth/logout', {}, options).then((res) => res.data.data),
};
