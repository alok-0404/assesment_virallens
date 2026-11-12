import { describe, it, expect } from 'vitest';
import { loadEnv, EnvValidationError, durationToMs } from '../src/config/env.js';
import { baseEnvInput } from './helpers/env.js';

describe('loadEnv', () => {
  it('accepts a valid configuration and applies defaults', () => {
    const env = loadEnv(baseEnvInput());
    expect(env.PORT).toBe(5000);
    expect(env.OPENROUTER_MODEL).toBe('openai/gpt-4o-mini');
    expect(env.COOKIE_SAMESITE).toBe('lax');
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.CLIENT_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.JWT_EXPIRES_MS).toBe(7 * 24 * 3600 * 1000);
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('coerces numeric strings and parses origin lists', () => {
    const env = loadEnv(
      baseEnvInput({ PORT: '8080', AI_TIMEOUT_MS: '5000', CLIENT_ORIGIN: 'http://a.com, http://b.com/' }),
    );
    expect(env.PORT).toBe(8080);
    expect(env.AI_TIMEOUT_MS).toBe(5000);
    expect(env.CLIENT_ORIGINS).toEqual(['http://a.com', 'http://b.com']);
  });

  it('treats empty strings as unset', () => {
    const env = loadEnv(baseEnvInput({ AI_SYSTEM_PROMPT: '', PORT: '' }));
    expect(env.AI_SYSTEM_PROMPT).toBeUndefined();
    expect(env.PORT).toBe(5000);
  });

  it('defaults COOKIE_SECURE to true in production', () => {
    expect(loadEnv(baseEnvInput({ NODE_ENV: 'production' })).COOKIE_SECURE).toBe(true);
  });

  it('reports every missing required variable', () => {
    const input = baseEnvInput();
    delete input.MONGODB_URI;
    delete input.JWT_SECRET;
    delete input.OPENROUTER_API_KEY;
    try {
      loadEnv(input);
      throw new Error('expected failure');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      expect(err.message).toContain('MONGODB_URI: is required');
      expect(err.message).toContain('JWT_SECRET: is required');
      expect(err.message).toContain('OPENROUTER_API_KEY: is required');
    }
  });

  it('rejects a short JWT secret without leaking its value', () => {
    const secret = 'short-secret-value';
    expect(() => loadEnv(baseEnvInput({ JWT_SECRET: secret }))).toThrow(EnvValidationError);
    try {
      loadEnv(baseEnvInput({ JWT_SECRET: secret, MONGODB_URI: 'postgres://user:pw@host/db' }));
    } catch (err) {
      expect(err.message).toContain('JWT_SECRET');
      expect(err.message).toContain('MONGODB_URI');
      expect(err.message).not.toContain(secret);
      expect(err.message).not.toContain('user:pw');
    }
  });

  it('rejects invalid enum and numeric values', () => {
    expect(() => loadEnv(baseEnvInput({ NODE_ENV: 'staging' }))).toThrow(/NODE_ENV/);
    expect(() => loadEnv(baseEnvInput({ PORT: 'abc' }))).toThrow(/PORT/);
    expect(() => loadEnv(baseEnvInput({ JWT_EXPIRES_IN: 'forever' }))).toThrow(/JWT_EXPIRES_IN/);
  });

  it('requires secure cookies when SameSite=none', () => {
    expect(() => loadEnv(baseEnvInput({ COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'false' }))).toThrow(
      /COOKIE_SECURE/,
    );
    expect(loadEnv(baseEnvInput({ COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'true' })).COOKIE_SECURE).toBe(true);
  });

  it('converts durations to milliseconds', () => {
    expect(durationToMs('30s')).toBe(30000);
    expect(durationToMs('15m')).toBe(900000);
    expect(durationToMs('2h')).toBe(7200000);
  });
});
