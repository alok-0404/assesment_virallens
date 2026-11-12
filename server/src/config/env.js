import { z } from 'zod';

export class EnvValidationError extends Error {
  constructor(problems) {
    super(
      `Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
    this.name = 'EnvValidationError';
    this.problems = problems;
  }
}

const booleanString = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const durationString = z
  .string()
  .regex(/^\d+[smhd]$/, 'must be a duration such as 15m, 12h or 7d');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

  MONGODB_URI: z
    .string({ error: 'is required' })
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),

  JWT_SECRET: z.string({ error: 'is required' }).min(32, 'must be at least 32 characters'),
  JWT_EXPIRES_IN: durationString.default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  COOKIE_SECURE: booleanString.optional(),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  OPENROUTER_API_KEY: z.string({ error: 'is required' }).min(1, 'is required'),
  OPENROUTER_MODEL: z.string().min(1).default('openai/gpt-4o-mini'),
  OPENROUTER_BASE_URL: z.url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_APP_URL: z.string().default('http://localhost:5173'),
  OPENROUTER_APP_NAME: z.string().default('AI Customer Support Agent'),
  AI_SYSTEM_PROMPT: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_MAX_TOKENS: z.coerce.number().int().min(16).max(32000).default(1024),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),
  AI_CONTEXT_MESSAGES: z.coerce.number().int().min(1).max(200).default(20),
  AI_CONTEXT_MAX_CHARS: z.coerce.number().int().min(1000).max(500000).default(12000),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  CHAT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  CHAT_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
});

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function durationToMs(value) {
  const [, amount, unit] = /^(\d+)([smhd])$/.exec(value);
  return Number(amount) * UNIT_MS[unit];
}

/**
 * Validates configuration. Error messages contain key names only, never values.
 */
export function loadEnv(source = process.env) {
  const input = {};
  for (const key of Object.keys(schema.shape)) {
    const raw = source[key];
    if (raw !== undefined && !(typeof raw === 'string' && raw.trim() === '')) {
      input[key] = typeof raw === 'string' ? raw.trim() : raw;
    }
  }

  const result = schema.safeParse(input);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const key = issue.path.join('.') || 'env';
      const message = issue.code === 'invalid_type' && input[key] === undefined ? 'is required' : issue.message;
      return `${key}: ${message}`;
    });
    throw new EnvValidationError(problems);
  }

  const env = result.data;
  const cookieSecure = env.COOKIE_SECURE ?? env.NODE_ENV === 'production';
  if (env.COOKIE_SAMESITE === 'none' && !cookieSecure) {
    throw new EnvValidationError(['COOKIE_SECURE: must be true when COOKIE_SAMESITE=none']);
  }

  return Object.freeze({
    ...env,
    COOKIE_SECURE: cookieSecure,
    CLIENT_ORIGINS: env.CLIENT_ORIGIN.split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
    JWT_EXPIRES_MS: durationToMs(env.JWT_EXPIRES_IN),
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  });
}
