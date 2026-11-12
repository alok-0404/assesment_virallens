import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { inject } from 'vitest';
import { connectDatabase } from '../../src/config/db.js';

/** Connects this test file to its own database on the shared in-memory mongod. */
export async function connectTestDb() {
  await connectDatabase(inject('mongoUri'), { dbName: `test_${randomUUID().slice(0, 8)}` });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function clearTestDb() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function disconnectTestDb() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}
