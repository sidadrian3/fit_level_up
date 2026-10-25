import type { ClientSession } from "mongodb";
import type { PlayerProfileDoc } from "@/server/platform/database";
import { emit } from "@/server/platform/events";
import {
  calcDisplayStreak,
  calcNewStreak,
  calcRecoveredStamina,
  levelFromTotalXp,
  recountStreak,
} from "./progression.rules";
import {
  applyActivityToProfile,
  findProfile,
  findProfiles,
  incrementTotalXp,
  newProfileDefaults,
  raiseHighestLevel,
  setStreak,
  setTotalXp,
  type Totals,
} from "./profile.repository";
import { deleteXp, recordXp, sumXp, upsertXp, type XpSource } from "./xp-ledger.repository";
import { getUserTimeZone } from "@/server/platform/auth";
import { addDays, toLocalDay } from "@/shared/time/calendar";

type XpGrant = {
  userId: string;
  source: XpSource;
  amount: number;
  occurredAt: Date;
};

async function addXp(
  { userId, source, amount, occurredAt }: XpGrant,
  session: ClientSession,
): Promise<{ profile: PlayerProfileDoc; leveledUp: boolean }> {
  await recordXp(userId, { source, amount, occurredAt }, session);
  const profile = await incrementTotalXp(userId, amount, session);

  const leveledUp = await settleLevelUp(userId, profile, session);

  return { profile, leveledUp };
}

async function settleLevelUp(
  userId: string,
  profile: PlayerProfileDoc,
  session: ClientSession,
): Promise<boolean> {
  const newLevel = levelFromTotalXp(profile.totalXp).level;
  if (newLevel <= profile.highestLevel) return false;

  await raiseHighestLevel(userId, newLevel, session);
  await emit(
    "progression.leveled-up",
    { userId, previousLevel: profile.highestLevel, newLevel },
    { session },
  );
  return true;
}

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

function toPlayerState(
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

export async function getPlayerStates(
  entries: { userId: string; timeZone: string }[],
  { now = new Date() }: { now?: Date } = {},
): Promise<Map<string, PlayerState>> {
  const profiles = await findProfiles(entries.map((entry) => entry.userId));
  const profileById = new Map(profiles.map((profile) => [profile._id, profile]));
  return new Map(
    entries.map(({ userId, timeZone }) => [
      userId,
      toPlayerState(profileById.get(userId) ?? newProfileDefaults(now), timeZone, now),
    ]),
  );
}

export type RecordActivityInput = Omit<XpGrant, "amount"> & {
  xp: number;
  staminaCost: number;
  totals: Totals;
};

export async function recordActivity(
  { userId, source, xp, staminaCost, totals, occurredAt }: RecordActivityInput,
  session: ClientSession,
): Promise<{ player: PlayerState; leveledUp: boolean }> {
  const now = new Date();
  // Sequential: operations in one transaction must not run concurrently.
  const stored = await findProfile(userId, { session });
  const timeZone = await getUserTimeZone(userId, { session });
  const profile = stored ?? newProfileDefaults(now);

  await applyActivityToProfile(
    userId,
    {
      streak: calcNewStreak(
        profile.streak,
        profile.lastActivityDay ?? undefined,
        occurredAt,
        timeZone,
      ),
      lastActivityDay: toLocalDay(occurredAt, timeZone),
      stamina: Math.max(
        0,
        calcRecoveredStamina(profile.stamina, profile.lastStaminaUpdate, now) -
          staminaCost,
      ),
      lastStaminaUpdate: now,
      totals,
    },
    session,
  );

  const { profile: updated, leveledUp } = await addXp(
    { userId, source, amount: xp, occurredAt },
    session,
  );
  return { player: toPlayerState(updated, timeZone, now), leveledUp };
}

export async function grantXp(
  grant: XpGrant,
  session: ClientSession,
): Promise<{ player: PlayerState; leveledUp: boolean }> {
  const { profile, leveledUp } = await addXp(grant, session);
  const timeZone = await getUserTimeZone(grant.userId, { session });
  return { player: toPlayerState(profile, timeZone, new Date()), leveledUp };
}

export type ReplaceSourceXpInput = {
  userId: string;
  source: XpSource;
  amount: number;
  occurredAt: Date;
  totals: Totals;
};

export async function replaceSourceXp(
  { userId, source, amount, occurredAt, totals }: ReplaceSourceXpInput,
  session: ClientSession,
): Promise<{ player: PlayerState; leveledUp: boolean }> {
  await upsertXp(userId, { source, amount, occurredAt }, session);
  const totalXp = await sumXp(userId, session);
  const profile = await setTotalXp(userId, totalXp, totals, session);
  const leveledUp = await settleLevelUp(userId, profile, session);
  const timeZone = await getUserTimeZone(userId, { session });
  return { player: toPlayerState(profile, timeZone, new Date()), leveledUp };
}

export type ActivityDays = {
  since(fromDay: string): Promise<string[]>;
  latest(): Promise<string | null>;
};

export type RevokeSourceInput = {
  userId: string;
  source: XpSource;
  occurredAt: Date;
  totals: Totals;
  activityDays?: ActivityDays;
};

type StreakState = { streak: number; lastActivityDay: string | null };

async function recountAfterDelete(
  { streak, lastActivityDay }: StreakState,
  deletedDay: string,
  activityDays: ActivityDays,
): Promise<StreakState | null> {
  if (streak === 0 || lastActivityDay === null) return null;
  const windowStart = addDays(lastActivityDay, -(streak - 1));
  if (deletedDay < windowStart || deletedDay > lastActivityDay) return null;

  const days = await activityDays.since(windowStart);
  if (days.includes(deletedDay)) return null;
  if (days.length > 0) return recountStreak(days);

  const latest = await activityDays.latest();
  return { streak: latest ? 1 : 0, lastActivityDay: latest };
}

export async function revokeSource(
  { userId, source, occurredAt, totals, activityDays }: RevokeSourceInput,
  session: ClientSession,
): Promise<{ player: PlayerState }> {
  await deleteXp(userId, source, session);
  const totalXp = await sumXp(userId, session);
  const profile = await setTotalXp(userId, totalXp, totals, session);
  const timeZone = await getUserTimeZone(userId, { session });

  const recounted = activityDays
    ? await recountAfterDelete(
        profile,
        toLocalDay(occurredAt, timeZone),
        activityDays,
      )
    : null;
  if (!recounted) {
    return { player: toPlayerState(profile, timeZone, new Date()) };
  }

  await setStreak(userId, recounted.streak, recounted.lastActivityDay, session);
  return {
    player: toPlayerState({ ...profile, ...recounted }, timeZone, new Date()),
  };
}
