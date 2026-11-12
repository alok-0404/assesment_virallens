import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

let listenersAttached = false;

export async function connectDatabase(uri, options = {}) {
  if (!listenersAttached) {
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
    mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err.message));
    listenersAttached = true;
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, ...options });
  return mongoose.connection;
}

export function disconnectDatabase() {
  return mongoose.disconnect();
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}
