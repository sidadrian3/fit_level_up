import type { ClientSession } from "mongodb";
import type { PlayerProfileDoc } from "@/server/platform/database";
import { emit } from "@/server/platform/events";
import { levelFromTotalXp } from "./progression.rules";
import { incrementTotalXp, raiseHighestLevel } from "./profile.repository";
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

  const leveledUp = await settleLevelUp(userId, profile, session);

  return { profile, leveledUp };
}

export async function settleLevelUp(
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
