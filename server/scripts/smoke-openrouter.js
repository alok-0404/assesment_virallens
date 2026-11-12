// Live check against the real OpenRouter API using server/.env. Requires a valid OPENROUTER_API_KEY.
import dotenv from 'dotenv';
import { loadEnv, EnvValidationError } from '../src/config/env.js';
import { createOpenRouterClient } from '../src/services/openrouter.service.js';

dotenv.config({ quiet: true });

let env;
try {
  // Only the OpenRouter settings are exercised; DB/JWT values are irrelevant for this check.
  env = loadEnv({
    ...process.env,
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://unused.invalid/none',
    JWT_SECRET: process.env.JWT_SECRET || 'smoke-test-placeholder-secret-0123456789',
  });
} catch (err) {
  if (err instanceof EnvValidationError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

const client = createOpenRouterClient(env);
const started = Date.now();
try {
  const reply = await client.complete([
    { role: 'user', content: 'Hi! My package arrived damaged. What should I do?' },
  ]);
  console.log(`OK model=${reply.model} in ${Date.now() - started}ms tokens=${reply.usage?.totalTokens ?? 'n/a'}`);
  console.log('---');
  console.log(reply.content.slice(0, 600));
  process.exit(0);
} catch (err) {
  console.error(`FAILED ${err.code ?? ''} ${err.message}`);
  process.exit(1);
}
