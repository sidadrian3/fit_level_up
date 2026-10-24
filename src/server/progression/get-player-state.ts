import type { ClientSession } from "mongodb";
import { getUserTimeZone } from "@/server/platform/auth";
import type { PlayerProfileDoc } from "@/server/platform/database";
import {
  calcDisplayStreak,
  calcRecoveredStamina,
  levelFromTotalXp,
} from "./progression.rules";
import { findProfile, newProfileDefaults } from "./profile.repository";

export type PlayerState = {
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalXp: number;
  streak: number;
  stamina: number;
  totalWorkouts: number;
  totalDistance: number;
  lastActivityDay?: string;
  lastStaminaUpdate: Date;
};

type ProfileFields = Omit<PlayerProfileDoc, "_id" | "updatedAt">;

export function toPlayerState(
  profile: ProfileFields,
  timeZone: string,
  now: Date,
): PlayerState {
  const lastActivityDay = profile.lastActivityDay ?? undefined;
  return {
    ...levelFromTotalXp(profile.totalXp),
    totalXp: profile.totalXp,
    streak: calcDisplayStreak(profile.streak, lastActivityDay, now, timeZone),
    stamina: calcRecoveredStamina(
      profile.stamina,
      profile.lastStaminaUpdate,
      now,
    ),
    totalWorkouts: profile.totalWorkouts,
    totalDistance: profile.totalDistance,
    lastActivityDay,
    lastStaminaUpdate: profile.lastStaminaUpdate,
  };
}

export async function getPlayerState(
  userId: string,
  { now = new Date(), session }: { now?: Date; session?: ClientSession } = {},
): Promise<PlayerState> {
  // Sequential: the session may be a transaction, which forbids concurrent operations.
  const profile = await findProfile(userId, { session });
  const timeZone = await getUserTimeZone(userId, { session });
  return toPlayerState(profile ?? newProfileDefaults(now), timeZone, now);
}
