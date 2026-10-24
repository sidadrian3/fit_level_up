import type { ClientSession } from "mongodb";
import { addXp, type XpGrant } from "./add-xp";
import { toPlayerState, type PlayerState } from "./get-player-state";
import { getUserTimeZone } from "@/server/platform/auth";

export async function grantXp(
  grant: XpGrant,
  session: ClientSession,
): Promise<{ player: PlayerState; leveledUp: boolean }> {
  const { profile, leveledUp } = await addXp(grant, session);
  const timeZone = await getUserTimeZone(grant.userId, { session });
  return { player: toPlayerState(profile, timeZone, new Date()), leveledUp };
}
