import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/helpers/globalSetup.js'],
    include: ['tests/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 60000,
    env: { NODE_ENV: 'test' },
  },
});
