import type { ClientSession } from "mongodb";
import { getUserTimeZone } from "@/server/platform/auth";
import { toLocalDay } from "@/shared/time/calendar";
import { addXp, type XpGrant } from "./add-xp";
import { toPlayerState, type PlayerState } from "./get-player-state";
import {
  applyActivityToProfile,
  findProfile,
  newProfileDefaults,
  type Totals,
} from "./profile.repository";
import { calcNewStreak, calcRecoveredStamina } from "./progression.rules";

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
