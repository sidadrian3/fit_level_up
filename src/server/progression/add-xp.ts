import type { ClientSession } from "mongodb";
import type { PlayerProfileDoc } from "@/server/platform/database";
import { emit } from "@/server/platform/events";
import { levelFromTotalXp } from "./progression.rules";
import { incrementTotalXp } from "./profile.repository";
import { recordXp, type XpSource } from "./xp-ledger.repository";

export type XpGrant = {
  userId: string;
  source: XpSource;
  amount: number;
  occurredAt: Date;
};

export async function addXp(
  { userId, source, amount, occurredAt }: XpGrant,
  session: ClientSession,
): Promise<{ profile: PlayerProfileDoc; leveledUp: boolean }> {
  await recordXp(userId, { source, amount, occurredAt }, session);
  const profile = await incrementTotalXp(userId, amount, session);

  const previousLevel = levelFromTotalXp(profile.totalXp - amount).level;
  const newLevel = levelFromTotalXp(profile.totalXp).level;
  const leveledUp = newLevel !== previousLevel;
  if (leveledUp)
    await emit(
      "progression.leveled-up",
      { userId, previousLevel, newLevel },
      { session },
    );

  return { profile, leveledUp };
}
