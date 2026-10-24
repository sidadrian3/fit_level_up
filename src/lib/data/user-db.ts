import { ObjectId, ClientSession } from "mongodb";
import type { User } from "@/lib/types";
import { getCollection, parseObjectId, type UserDoc } from "@/server/platform/database";

export function toUser(doc: UserDoc): User {
  const lastActivityStr = doc.lastActivityDate ? doc.lastActivityDate.toISOString().slice(0, 10) : undefined;

  return {
    id: doc._id?.toString() || doc.id || "",
    email: doc.email || "",
    name: doc.name || "",
    avatar: doc.avatar || doc.image || "zap",
    level: doc.level ?? 1,
    xp: doc.xp ?? 0,
    xpToNextLevel: doc.xpToNextLevel ?? 500,
    streak: doc.streak ?? 0,
    totalWorkouts: doc.totalWorkouts ?? 0,
    totalDistance: doc.totalDistance ?? 0,
    joinDate: doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    lastActivityDate: lastActivityStr,
    stamina: doc.stamina ?? 100,
    lastStaminaUpdate: doc.lastStaminaUpdate ? new Date(doc.lastStaminaUpdate).toISOString() : new Date().toISOString(),
    timeZone: doc.timeZone ?? "UTC",
    __v: doc.__v ?? 0,
  };
}

export async function getUserFromDb(userId: string, session?: ClientSession): Promise<User | null> {
  const collection = await getCollection<UserDoc>("user");

  const _id = parseObjectId(userId);
  const userDoc = _id ? await collection.findOne({ _id }, { session }) : null;
  return userDoc ? toUser(userDoc) : null;
}

export async function getUserTimeZoneFromDb(userId: string, session?: ClientSession): Promise<string> {
  const collection = await getCollection<UserDoc>("user");

  const _id = parseObjectId(userId);
  const userDoc = _id ? await collection.findOne({ _id }, { session, projection: { timeZone: 1 } }) : null;
  return userDoc?.timeZone ?? "UTC";
}

export async function updateUserXPInDb(
  userId: string,
  newXp: number,
  newLevel: number,
  newXpToNextLevel: number,
  currentVersion: number,
  session?: ClientSession
): Promise<User> {
  const collection = await getCollection<UserDoc>("user");

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
      $inc: { __v: 1 } as Record<string, number>
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
  const collection = await getCollection<UserDoc>("user");

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

export async function updateUserStaminaInDb(
  userId: string,
  newStamina: number,
  lastStaminaUpdate: string,
  session?: ClientSession
): Promise<void> {
  const collection = await getCollection<UserDoc>("user");
  await collection.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { stamina: newStamina, lastStaminaUpdate: new Date(lastStaminaUpdate) } },
    { session }
  )
}

export interface UserActivityUpdates {
  newXp: number;
  newLevel: number;
  newXpToNextLevel: number;
  newStreak: number;
  lastActivityDate: Date;
  newStamina: number;
  lastStaminaUpdate: Date;
  incrementWorkouts?: number;
  incrementDistance?: number;
}

export async function applyUserActivityInDb(
  userId: string,
  updates: UserActivityUpdates,
  currentVersion: number,
  session?: ClientSession
): Promise<User> {
  const collection = await getCollection<UserDoc>("user");

  const query = currentVersion === 0 
    ? { _id: new ObjectId(userId), $or: [{ __v: 0 }, { __v: { $exists: false } }] }
    : { _id: new ObjectId(userId), __v: currentVersion };

  const incParams: Record<string, number> = { __v: 1 };
  if (updates.incrementWorkouts) incParams.totalWorkouts = updates.incrementWorkouts;
  if (updates.incrementDistance) incParams.totalDistance = updates.incrementDistance;

  const result = await collection.findOneAndUpdate(
    query,
    {
      $set: {
        xp: updates.newXp,
        level: updates.newLevel,
        xpToNextLevel: updates.newXpToNextLevel,
        streak: updates.newStreak,
        lastActivityDate: updates.lastActivityDate,
        stamina: updates.newStamina,
        lastStaminaUpdate: updates.lastStaminaUpdate,
      },
      $inc: incParams
    },
    { session, returnDocument: "after" }
  );

  if (!result) {
    throw new Error("OptimisticLockError");
  }

  return toUser(result);
}
