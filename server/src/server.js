import dotenv from 'dotenv';
import { loadEnv, EnvValidationError } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

dotenv.config({ quiet: true });

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main() {
  let env;
  try {
    env = loadEnv();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  await connectDatabase(env.MONGODB_URI);
  logger.info('Connected to MongoDB');

  const app = createApp(env);
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  let shuttingDown = false;
  const shutdown = async (reason, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Shutting down (${reason})...`);
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(async () => {
      await disconnectDatabase().catch(() => {});
      logger.info('Shutdown complete');
      process.exit(exitCode);
    });
    server.closeIdleConnections?.();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
    shutdown('unhandledRejection', 1);
  });
}

main().catch((err) => {
  logger.error('Fatal startup error:', err?.message || err);
  process.exit(1);
});
