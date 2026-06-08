import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { User } from "@/lib/types";
import { DEMO_USER_ID } from "@/lib/constants/demo-user";

export type UserMongoDoc = {
  _id?: ObjectId;
  userId: string;
  name: string;
  avatar: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  streak: number;
  totalWorkouts: number;
  totalDistance: number;
  joinDate: string;
};

function getDbConfig() {
  const dbName = process.env.MONGODB_DB;
  const usersCollection = process.env.MONGODB_USERS_COLLECTION || "users";

  if (!dbName) {
    throw new Error("Missing MONGODB_DB in .env.local");
  }

  return { dbName, usersCollection };
}

function toUser(doc: UserMongoDoc): User {
  return {
    name: doc.name,
    avatar: doc.avatar,
    level: doc.level,
    xp: doc.xp,
    xpToNextLevel: doc.xpToNextLevel,
    streak: doc.streak,
    totalWorkouts: doc.totalWorkouts,
    totalDistance: doc.totalDistance,
    joinDate: doc.joinDate,
  };
}

export async function createOrGetDemoUser(userId: string = DEMO_USER_ID): Promise<UserMongoDoc> {
  const { dbName, usersCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<UserMongoDoc>(usersCollection);

  const existing = await collection.findOne({ userId });
  if (existing) {
    return existing;
  }

  const newUser: UserMongoDoc = {
    userId,
    name: "Sid",
    avatar: "⚔️",
    level: 1,
    xp: 0,
    xpToNextLevel: 500,
    streak: 0,
    totalWorkouts: 0,
    totalDistance: 0,
    joinDate: new Date().toISOString().slice(0, 10),
  };

  const result = await collection.insertOne(newUser);
  return { ...newUser, _id: result.insertedId };
}

export async function getUserFromDb(userId: string = DEMO_USER_ID): Promise<User> {
  const userDoc = await createOrGetDemoUser(userId);
  return toUser(userDoc);
}

export async function grantXP(userId: string, amount: number): Promise<{ user: User; levelUp: boolean }> {
  const { dbName, usersCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<UserMongoDoc>(usersCollection);

  const userDoc = await createOrGetDemoUser(userId);
  
  let newXp = userDoc.xp + amount;
  let newLevel = userDoc.level;
  let newXpToNextLevel = userDoc.xpToNextLevel;
  let levelUp = false;

  while (newXp >= newXpToNextLevel) {
    newXp -= newXpToNextLevel;
    newLevel += 1;
    newXpToNextLevel = newLevel * 500;
    levelUp = true;
  }

  const result = await collection.findOneAndUpdate(
    { userId },
    {
      $set: {
        xp: newXp,
        level: newLevel,
        xpToNextLevel: newXpToNextLevel,
      },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new Error("Failed to update user XP");
  }

  return { user: toUser(result), levelUp };
}

export async function updateUserStats(
  userId: string,
  stats: { incrementWorkouts?: number; incrementDistance?: number }
): Promise<void> {
  const { dbName, usersCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<UserMongoDoc>(usersCollection);

  const incParams: Record<string, number> = {};
  if (stats.incrementWorkouts) {
    incParams.totalWorkouts = stats.incrementWorkouts;
  }
  if (stats.incrementDistance) {
    incParams.totalDistance = stats.incrementDistance;
  }

  if (Object.keys(incParams).length === 0) {
    return;
  }

  await collection.updateOne({ userId }, { $inc: incParams });
}
