import type { ClientSession } from "mongodb";
import {
  getCollection,
  type PlayerProfileDoc,
} from "@/server/platform/database";

export type ActivityUpdate = {
  streak: number;
  lastActivityDay: string;
  stamina: number;
  lastStaminaUpdate: Date;
  totals: { workouts?: number; distanceKm?: number };
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
  const increments: Partial<
    Pick<PlayerProfileDoc, "totalWorkouts" | "totalDistance">
  > = {};
  if (totals.workouts) increments.totalWorkouts = totals.workouts;
  if (totals.distanceKm) increments.totalDistance = totals.distanceKm;

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
