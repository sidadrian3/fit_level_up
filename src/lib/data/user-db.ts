import { ObjectId, ClientSession } from "mongodb";
import type { User } from "@/lib/types";
import { getCollection } from "@/lib/data/get-collection";
import { calcNewStreak } from "@/lib/domain/user-rules";
import { calcRecoveredStamina } from "@/lib/domain/stamina-rules";

export type UserMongoDoc = {
  _id?: ObjectId;
  id?: string;
  email: string;
  name: string;
  image?: string;
  avatar?: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  streak: number;
  lastActivityDate?: Date; // YYYY-MM-DD
  totalWorkouts: number;
  totalDistance: number;
  createdAt: Date;
  stamina: number;
  lastStaminaUpdate: Date;
  __v?: number;
};



export function toUser(doc: UserMongoDoc): User {
  const lastActivityStr = doc.lastActivityDate ? doc.lastActivityDate.toISOString().slice(0, 10) : undefined;

  // Compute display streak: if last activity wasn't today or yesterday, streak is broken
  let displayStreak = doc.streak;
  if (displayStreak > 0 && lastActivityStr) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (lastActivityStr !== today && lastActivityStr !== yesterday) {
      displayStreak = 0;
    }
  }

  const rawStamina = doc.stamina ?? 100;
  const recoveredStamina = calcRecoveredStamina(rawStamina, doc.lastStaminaUpdate, new Date());

  return {
    id: doc._id?.toString() || doc.id || "",
    email: doc.email || "",
    name: doc.name || "",
    avatar: doc.avatar || doc.image || "zap",
    level: doc.level ?? 1,
    xp: doc.xp ?? 0,
    xpToNextLevel: doc.xpToNextLevel ?? 500,
    streak: displayStreak ?? 0,
    totalWorkouts: doc.totalWorkouts ?? 0,
    totalDistance: doc.totalDistance ?? 0,
    joinDate: doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    stamina: recoveredStamina,
    lastStaminaUpdate: doc.lastStaminaUpdate ? new Date(doc.lastStaminaUpdate).toISOString() : new Date().toISOString(),
    __v: doc.__v ?? 0,
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
  currentVersion: number,
  session?: ClientSession
): Promise<User> {
  const collection = await getCollection<UserMongoDoc>("usersCollection");

  const query = currentVersion === 0 
    ? { _id: new ObjectId(userId), $or: [{ __v: 0 }, { __v: { $exists: false } }] }
    : { _id: new ObjectId(userId), __v: currentVersion };

  const result = await collection.findOneAndUpdate(
    query,
    {
      $set: {
        xp: newXp,
        level: newLevel,
        xpToNextLevel: newXpToNextLevel,
      },
      $inc: { __v: 1 } as any
    },
    { session, returnDocument: "after" }
  );

  if (!result) {
    throw new Error("OptimisticLockError");
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
    { $set: { streak: newStreak, lastActivityDate: new Date(activityDate) } },
    { session }
  );
}

export async function updateUserStaminaInDb(
  userId: string,
  newStamina: number,
  lastStaminaUpdate: string,
  session?: ClientSession
): Promise<void> {
  const collection = await getCollection<UserMongoDoc>("usersCollection");
  await collection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { stamina: newStamina, lastStaminaUpdate: new Date(lastStaminaUpdate) } },
    { session }
  )
}

