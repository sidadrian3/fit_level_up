import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { User } from "@/lib/types";
import { calculateStreak } from "@/lib/utils/calculations";

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
  totalWorkouts?: number;
  totalDistance?: number;
  createdAt?: Date;
};

function getDbConfig() {
  const dbName = process.env.MONGODB_DB;
  const usersCollection = "user"; // Better Auth uses 'user' by default
  const workoutsCollection = process.env.MONGODB_WORKOUTS_COLLECTION || "workouts";
  const runsCollection = process.env.MONGODB_RUNS_COLLECTION || "runs";

  if (!dbName) {
    throw new Error("Missing MONGODB_DB in .env.local");
  }

  return { dbName, usersCollection, workoutsCollection, runsCollection };
}

function toUser(doc: UserMongoDoc): User {
  return {
    id: doc._id?.toString() || doc.id || "",
    email: doc.email || "",
    name: doc.name || "",
    avatar: doc.avatar || doc.image || "zap",
    level: doc.level || 1,
    xp: doc.xp || 0,
    xpToNextLevel: doc.xpToNextLevel || 500,
    streak: doc.streak || 0,
    totalWorkouts: doc.totalWorkouts || 0,
    totalDistance: doc.totalDistance || 0,
    // Better Auth sets createdAt as a Date.
    joinDate: doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

export async function getUserFromDb(userId: string): Promise<User> {
  const { dbName, usersCollection, workoutsCollection, runsCollection } = getDbConfig();
  const client = await clientPromise;
  const db = client.db(dbName);
  const collection = db.collection<UserMongoDoc>(usersCollection);

  // Better Auth stores id as ObjectId in _id
  console.log("getUserFromDb called with userId:", userId, "typeof:", typeof userId);
  const userDoc = await collection.findOne({ _id: new ObjectId(userId) });
  if (!userDoc) {
    console.log("Could not find userDoc for _id:", new ObjectId(userId));
    throw new Error("User not found");
  }

  // Calculate streak dynamically
  const workoutDocs = await db.collection(workoutsCollection).find({ userId }, { projection: { date: 1 } }).toArray();
  const runDocs = await db.collection(runsCollection).find({ userId }, { projection: { date: 1 } }).toArray();
  const allDates = [...workoutDocs.map(d => d.date), ...runDocs.map(d => d.date)].filter(Boolean) as string[];
  
  const currentStreak = calculateStreak(allDates);

  // If streak changed, update it
  if (userDoc.streak !== currentStreak) {
    userDoc.streak = currentStreak;
    await collection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { streak: currentStreak } }
    );
  }

  return toUser(userDoc);
}

export async function grantXP(userId: string, amount: number): Promise<{ user: User; levelUp: boolean }> {
  const { dbName, usersCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<UserMongoDoc>(usersCollection);

  const userDoc = await getUserFromDb(userId);
  
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
    { _id: new ObjectId(userId) },
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

  await collection.updateOne({ _id: new ObjectId(userId) }, { $inc: incParams });
}
