import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet: MongoMemoryReplSet;

export async function setup() {
  // We use a Replica Set instead of a standalone server because our
  // service layer uses MongoDB Transactions, which require a Replica Set.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGODB_DB = 'testdb';
  process.env.MONGODB_WORKOUTS_COLLECTION = 'workouts';
  process.env.MONGODB_RUNS_COLLECTION = 'runs';
  process.env.MONGODB_USER_QUESTS_COLLECTION = 'user_quests';
  process.env.MONGODB_ACHIEVEMENTS_COLLECTION = 'achievements';
  process.env.MONGODB_USER_ACHIEVEMENTS_COLLECTION = 'user_achievements';
  process.env.MONGODB_QUEST_TEMPLATES_COLLECTION = 'quest_templates';
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL = 'http://localhost:3000';

  console.log('Global Setup: MongoMemoryReplSet started at', process.env.MONGODB_URI);
}

export async function teardown() {
  if (replSet) {
    await replSet.stop();
    console.log('Global Teardown: MongoMemoryReplSet stopped');
  }
}
