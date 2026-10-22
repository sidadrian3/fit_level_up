import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet: MongoMemoryReplSet;

export async function setup() {
  // We use a Replica Set instead of a standalone server because our
  // service layer uses MongoDB Transactions, which require a Replica Set.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGODB_DB = 'testdb';
  process.env.BETTER_AUTH_SECRET = 'test-secret-for-vitest';
  process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis-url.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  process.env.CRON_SECRET = 'test-cron-secret-0123456789';
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL = 'http://localhost:3000';

  const { applySchema, clientPromise, getDb } = await import('@/server/platform/database');
  await applySchema(await getDb());
  (await clientPromise).close();

  console.log('Global Setup: MongoMemoryReplSet started at', process.env.MONGODB_URI);
}

export async function teardown() {
  if (replSet) {
    await replSet.stop();
    console.log('Global Teardown: MongoMemoryReplSet stopped');
  }
}
