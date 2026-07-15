import { getAcceptedFriendIdsFromDb } from "@/lib/data/friendships-db";
import { getUserFromDb } from "@/lib/data/user-db";
import { sseRegistry } from "@/lib/sse/sse-registry";

export async function notifyFriendsLevelUp(userId: string, newLevel: number): Promise<void> {
  const friendIds = await getAcceptedFriendIdsFromDb(userId);
  if (friendIds.length === 0) return;

  const user = await getUserFromDb(userId);
  if (!user) return;

  sseRegistry.notifyMany(friendIds, {
    type: "friend_level_up",
    payload: {
      actorId: userId,
      actorName: user.name,
      actorAvatar: user.avatar,
      newLevel,
      timestamp: new Date().toISOString(),
    },
  });
}
