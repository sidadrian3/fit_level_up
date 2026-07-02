import { ObjectId, ClientSession } from "mongodb";
import type { User } from "@/lib/types";
import { getCollection } from "@/lib/data/get-collection";
import { calcNewStreak } from "@/lib/domain/user-rules";

export type UserMongoDoc = {
  _id?: ObjectId;
  id?: string;
  email: string;
  name: string;
  image?: string;
  avatar?: string;
  level?: number;
  xp?: number;
  xpToNextLevel?: number;
  streak?: number;
  lastActivityDate?: string; // YYYY-MM-DD
  totalWorkouts?: number;
  totalDistance?: number;
  createdAt?: Date;
};

export function toUser(doc: UserMongoDoc): User {
  // Compute display streak: if last activity wasn't today or yesterday, streak is broken
  let displayStreak = doc.streak || 0;
  if (displayStreak > 0 && doc.lastActivityDate) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (doc.lastActivityDate !== today && doc.lastActivityDate !== yesterday) {
      displayStreak = 0;
    }
  }

  return {
    id: doc._id?.toString() || doc.id || "",
    email: doc.email || "",
    name: doc.name || "",
    avatar: doc.avatar || doc.image || "zap",
    level: doc.level || 1,
    xp: doc.xp || 0,
    xpToNextLevel: doc.xpToNextLevel || 500,
    streak: displayStreak,
    totalWorkouts: doc.totalWorkouts || 0,
    totalDistance: doc.totalDistance || 0,
    joinDate: doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

export async function getUserFromDb(userId: string, session?: ClientSession): Promise<User> {
  const collection = await getCollection<UserMongoDoc>("usersCollection");

  const userDoc = await collection.findOne({ _id: new ObjectId(userId) }, { session });
  if (!userDoc) {
    throw new Error("User not found");
  }
  return toUser(userDoc);
}

export async function updateUserStreakInDb(userId: string, currentStreak: number): Promise<void> {
  const collection = await getCollection<UserMongoDoc>("usersCollection");

  await collection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { streak: currentStreak } }
  );
}

export async function updateUserXPInDb(
  userId: string,
  newXp: number,
  newLevel: number,
  newXpToNextLevel: number,
  session?: ClientSession
): Promise<User> {
  const collection = await getCollection<UserMongoDoc>("usersCollection");

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    {
      $set: {
        xp: newXp,
        level: newLevel,
        xpToNextLevel: newXpToNextLevel,
      },
    },
    { session, returnDocument: "after" }
  );

  if (!result) {
    throw new Error("Failed to update user XP");
  }

  return toUser(result);
}

export async function updateUserStatsInDb(
  userId: string,
  stats: { incrementWorkouts?: number; incrementDistance?: number },
  session?: ClientSession
): Promise<void> {
  const collection = await getCollection<UserMongoDoc>("usersCollection");

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

  await collection.updateOne({ _id: new ObjectId(userId) }, { $inc: incParams }, { session });
}

export async function updateUserStreakOnActivity(
  userId: string,
  activityDate: string,
  session?: ClientSession
): Promise<void> {
  const collection = await getCollection<UserMongoDoc>("usersCollection");

  const user = await collection.findOne({ _id: new ObjectId(userId) }, { session });
  if (!user) return;

  const newStreak = calcNewStreak(user.streak, user.lastActivityDate, activityDate);

  await collection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { streak: newStreak, lastActivityDate: activityDate } },
    { session }
  );
}
