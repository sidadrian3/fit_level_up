import type { ClientSession } from "mongodb";
import { getUserTimeZone } from "@/server/platform/auth";
import { settleLevelUp } from "./add-xp";
import { toPlayerState, type PlayerState } from "./get-player-state";
import { setTotalXp, type Totals } from "./profile.repository";
import { sumXp, upsertXp, type XpSource } from "./xp-ledger.repository";

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
