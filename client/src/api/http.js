import axios from 'axios';

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  // Generous enough for a cold-starting free-tier backend (Render) on the first request.
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

let csrfToken = null;
let csrfRequest = null;

export function resetCsrfToken() {
  csrfToken = null;
}

export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  csrfRequest ??= http
    .get('/auth/csrf-token', { skipAuthHandler: true })
    .then((res) => {
      csrfToken = res.data.data.csrfToken;
      return csrfToken;
    })
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

let unauthorizedHandler = null;

/** Called when an authenticated request is rejected with 401 (session expired). */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

http.interceptors.request.use(async (config) => {
  if (MUTATING_METHODS.has(config.method?.toLowerCase())) {
    config.headers.set('X-CSRF-Token', await getCsrfToken());
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const code = response?.data?.error?.code;

    if (response?.status === 403 && code === 'CSRF_INVALID' && config && !config.csrfRetried) {
      config.csrfRetried = true;
      resetCsrfToken();
      return http(config);
    }

    if (response?.status === 401 && !config?.skipAuthHandler) {
      unauthorizedHandler?.();
    }

    return Promise.reject(error);
  },
);
