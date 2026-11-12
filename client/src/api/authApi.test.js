import { describe, it, expect, beforeEach } from 'vitest';
import { http, resetCsrfToken } from './http.js';
import { authApi } from './authApi.js';

let requests;

beforeEach(() => {
  requests = [];
  resetCsrfToken();
  http.defaults.adapter = (config) => {
    requests.push(config);
    const data =
      config.url === '/auth/csrf-token'
        ? { success: true, data: { csrfToken: 'token-1' } }
        : { success: true, data: { loggedOut: true } };
    return Promise.resolve({ status: 200, statusText: 'OK', headers: {}, config, data });
  };
});

describe('authApi.logout', () => {
  it('sends a JSON object body that a strict JSON parser accepts', async () => {
    await expect(authApi.logout()).resolves.toEqual({ loggedOut: true });
    const logout = requests.find((r) => r.url === '/auth/logout');
    expect(logout.method).toBe('post');
    expect(logout.headers['X-CSRF-Token']).toBe('token-1');
    const parsed = JSON.parse(logout.data);
    expect(parsed).not.toBeNull();
    expect(typeof parsed).toBe('object');
  });
});
