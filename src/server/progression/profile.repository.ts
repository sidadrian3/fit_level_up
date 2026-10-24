import type { ClientSession } from "mongodb";
import {
  getCollection,
  type PlayerProfileDoc,
} from "@/server/platform/database";

export type Totals = { workouts?: number; distanceKm?: number };

export type ActivityUpdate = {
  streak: number;
  lastActivityDay: string;
  stamina: number;
  lastStaminaUpdate: Date;
  totals: Totals;
};

export function newProfileDefaults(
  now: Date,
): Omit<PlayerProfileDoc, "_id" | "updatedAt"> {
  return {
    totalXp: 0,
    highestLevel: 1,
    streak: 0,
    lastActivityDay: null,
    stamina: 100,
    lastStaminaUpdate: now,
    totalWorkouts: 0,
    totalDistance: 0,
    createdAt: now,
  };
}

// Mongo rejects one path in both $setOnInsert and $set/$inc, so defaults skip touched fields.
function defaultsExcept(
  now: Date,
  touched: readonly string[],
): Partial<PlayerProfileDoc> {
  return Object.fromEntries(
    Object.entries(newProfileDefaults(now)).filter(
      ([field]) => !touched.includes(field),
    ),
  );
}

async function profiles() {
  return getCollection<PlayerProfileDoc>("playerProfiles");
}

export async function findProfile(
  userId: string,
  { session }: { session?: ClientSession } = {},
): Promise<PlayerProfileDoc | null> {
  return (await profiles()).findOne({ _id: userId }, { session });
}

function totalsIncrements(
  totals: Totals,
): Partial<Pick<PlayerProfileDoc, "totalWorkouts" | "totalDistance">> {
  return {
    ...(totals.workouts && { totalWorkouts: totals.workouts }),
    ...(totals.distanceKm && { totalDistance: totals.distanceKm }),
  };
}

export async function applyActivityToProfile(
  userId: string,
  {
    streak,
    lastActivityDay,
    stamina,
    lastStaminaUpdate,
    totals,
  }: ActivityUpdate,
  session: ClientSession,
): Promise<void> {
  const now = new Date();
  const increments = totalsIncrements(totals);

  const touched = [
    "streak",
    "lastActivityDay",
    "stamina",
    "lastStaminaUpdate",
    ...Object.keys(increments),
  ];
  await (
    await profiles()
  ).findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        streak,
        lastActivityDay,
        stamina,
        lastStaminaUpdate,
        updatedAt: now,
      },
      ...(Object.keys(increments).length > 0 && { $inc: increments }),
      $setOnInsert: defaultsExcept(now, touched),
    },
    { upsert: true, session },
  );
}

export async function incrementTotalXp(
  userId: string,
  amount: number,
  session: ClientSession,
): Promise<PlayerProfileDoc> {
  const now = new Date();
  const after = await (
    await profiles()
  ).findOneAndUpdate(
    { _id: userId },
    {
      $inc: { totalXp: amount },
      $set: { updatedAt: now },
      $setOnInsert: defaultsExcept(now, ["totalXp"]),
    },
    { upsert: true, session, returnDocument: "after" },
  );
  if (!after) throw new Error("Profile upsert returned no document");
  return after;
}

export async function raiseHighestLevel(
  userId: string,
  level: number,
  session: ClientSession,
): Promise<void> {
  await (
    await profiles()
  ).updateOne({ _id: userId }, { $max: { highestLevel: level } }, { session });
}

export async function setTotalXp(
  userId: string,
  totalXp: number,
  totals: Totals,
  session: ClientSession,
): Promise<PlayerProfileDoc> {
  const now = new Date();
  const increments = totalsIncrements(totals);
  const touched = ["totalXp", ...Object.keys(increments)];
  const after = await (
    await profiles()
  ).findOneAndUpdate(
    { _id: userId },
    {
      $set: { totalXp, updatedAt: now },
      ...(Object.keys(increments).length > 0 && { $inc: increments }),
      $setOnInsert: defaultsExcept(now, touched),
    },
    { upsert: true, session, returnDocument: "after" },
  );
  if (!after) throw new Error("Profile upsert returned no document");
  return after;
}

export async function setStreak(
  userId: string,
  streak: number,
  lastActivityDay: string | null,
  session: ClientSession,
): Promise<void> {
  await (
    await profiles()
  ).updateOne(
    { _id: userId },
    { $set: { streak, lastActivityDay, updatedAt: new Date() } },
    { session },
  );
}
