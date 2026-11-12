import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, resetCsrfToken, setUnauthorizedHandler } from './http.js';

function respond(config, status, data) {
  const response = { status, data, headers: {}, config, statusText: String(status) };
  if (status >= 400) {
    const error = new Error(`Request failed with status ${status}`);
    error.config = config;
    error.response = response;
    error.isAxiosError = true;
    return Promise.reject(error);
  }
  return Promise.resolve(response);
}

let calls;
let tokenCounter;
let acceptedToken;

beforeEach(() => {
  calls = [];
  tokenCounter = 0;
  acceptedToken = null;
  resetCsrfToken();
  setUnauthorizedHandler(null);
  http.defaults.adapter = (config) => {
    calls.push({ method: config.method, url: config.url, csrf: config.headers['X-CSRF-Token'] });
    if (config.url === '/auth/csrf-token') {
      tokenCounter += 1;
      return respond(config, 200, { success: true, data: { csrfToken: `token-${tokenCounter}` } });
    }
    if (config.url === '/private') {
      return respond(config, 401, { success: false, error: { code: 'UNAUTHORIZED' } });
    }
    const valid = acceptedToken ? config.headers['X-CSRF-Token'] === acceptedToken : true;
    if (!valid) return respond(config, 403, { success: false, error: { code: 'CSRF_INVALID' } });
    return respond(config, 200, { success: true, data: { ok: true } });
  };
});

describe('http client', () => {
  it('sends credentials, uses /api as the default base URL and a 60 s timeout', () => {
    expect(http.defaults.withCredentials).toBe(true);
    expect(http.defaults.baseURL).toBe('/api');
    expect(http.defaults.timeout).toBe(60000);
  });

  it('attaches a CSRF token to mutating requests, fetching it once', async () => {
    await Promise.all([http.post('/a', {}), http.delete('/b')]);
    await http.post('/c', {});
    const tokenFetches = calls.filter((c) => c.url === '/auth/csrf-token');
    expect(tokenFetches).toHaveLength(1);
    expect(calls.filter((c) => c.url !== '/auth/csrf-token').every((c) => c.csrf === 'token-1')).toBe(true);
  });

  it('does not attach a token to GET requests', async () => {
    await http.get('/a');
    expect(calls).toEqual([{ method: 'get', url: '/a', csrf: undefined }]);
  });

  it('refreshes the token and retries once on CSRF_INVALID', async () => {
    await http.post('/warmup', {});
    acceptedToken = 'token-2';
    const res = await http.post('/a', {});
    expect(res.data.data.ok).toBe(true);
    expect(calls.map((c) => `${c.url}:${c.csrf ?? '-'}`)).toEqual([
      '/auth/csrf-token:-',
      '/warmup:token-1',
      '/a:token-1',
      '/auth/csrf-token:-',
      '/a:token-2',
    ]);
  });

  it('calls the unauthorized handler on 401 unless skipped', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(http.get('/private')).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
    await expect(http.get('/private', { skipAuthHandler: true })).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
