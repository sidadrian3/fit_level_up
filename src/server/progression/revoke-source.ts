import type { ClientSession } from "mongodb";
import { getUserTimeZone } from "@/server/platform/auth";
import { addDays, toLocalDay } from "@/shared/time/calendar";
import { toPlayerState, type PlayerState } from "./get-player-state";
import { setStreak, setTotalXp, type Totals } from "./profile.repository";
import { recountStreak } from "./progression.rules";
import { deleteXp, sumXp, type XpSource } from "./xp-ledger.repository";

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
