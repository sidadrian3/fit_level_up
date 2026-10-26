import type { ClientSession } from "mongodb";
import { getAccount } from "@/server/platform/auth";
import { NotFoundError } from "@/server/platform/http";
import { getPlayerState } from "@/server/progression";
import type { User } from "@/shared/contracts/user";

export async function getUser(
  userId: string,
  { session, now = new Date() }: { session?: ClientSession; now?: Date } = {},
): Promise<User> {
  // Sequential: the session may be a transaction, which forbids concurrent operations.
  const account = await getAccount(userId, { session });
  if (!account) throw new NotFoundError("User not found");
  const player = await getPlayerState(userId, { now, session });

  return {
    ...account,
    level: player.level,
    xp: player.xp,
    xpToNextLevel: player.xpToNextLevel,
    streak: player.streak,
    totalWorkouts: player.totalWorkouts,
    totalDistance: player.totalDistance,
    stamina: player.stamina,
    lastActivityDate: player.lastActivityDay,
    lastStaminaUpdate: player.lastStaminaUpdate.toISOString(),
  };
}
