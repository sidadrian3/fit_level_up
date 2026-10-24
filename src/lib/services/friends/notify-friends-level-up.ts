import { getAcceptedFriendIds } from "@/server/social";
import { getUser } from "@/lib/services/users/get-user";
import { publishToMany } from "@/lib/sse/sse-publisher";

export async function notifyFriendsLevelUp(userId: string, newLevel: number): Promise<void> {
  const friendIds = await getAcceptedFriendIds(userId);
  if (friendIds.length === 0) return;

  const user = await getUser(userId);
  if (!user) return;

  await publishToMany(friendIds, {
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

