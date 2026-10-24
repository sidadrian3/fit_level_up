import { GAME_CONFIG } from "@/server/platform/config";
import { ForbiddenError, NotFoundError } from "@/server/platform/http";
import { checkFriendshipTransition } from "./friendship.rules";
import { deletePair, findPair } from "./friendship.repository";

export async function removeFriend(targetUserId: string, userId: string): Promise<{ success: boolean }> {
  const friendship = await findPair(userId, targetUserId);
  if (!friendship) throw new NotFoundError("Friendship not found.");

  const verdict = checkFriendshipTransition(
    "remove",
    friendship,
    userId,
    new Date(),
    GAME_CONFIG.social.friendRequestCooldownDays,
  );
  if (verdict === "wrongState") throw new NotFoundError("Friendship not found.");
  if (verdict === "notAllowed") throw new ForbiddenError("Not authorized to remove this friend.");

  return { success: await deletePair(userId, targetUserId) };
}
