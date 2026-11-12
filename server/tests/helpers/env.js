import { loadEnv } from '../../src/config/env.js';

export const TEST_JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';

export function baseEnvInput(overrides = {}) {
  return {
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/unused',
    JWT_SECRET: TEST_JWT_SECRET,
    OPENROUTER_API_KEY: 'test-openrouter-key',
    BCRYPT_SALT_ROUNDS: '4',
    RATE_LIMIT_MAX: '10000',
    AUTH_RATE_LIMIT_MAX: '10000',
    CHAT_RATE_LIMIT_MAX: '10000',
    CLIENT_ORIGIN: 'http://localhost:5173',
    AI_MAX_RETRIES: '0',
    ...overrides,
  };
}

export function testEnv(overrides = {}) {
  return loadEnv(baseEnvInput(overrides));
}
