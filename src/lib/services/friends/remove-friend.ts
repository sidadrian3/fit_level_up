import { getFriendshipBetweenFromDb, deleteFriendshipInDb } from "@/lib/data/friendships-db";
import { NotFoundError, UnauthorizedError } from "@/lib/api/errors";

export async function removeFriend(targetUserId: string, userId: string): Promise<{ success: boolean }> {
    const friendship = await getFriendshipBetweenFromDb(userId, targetUserId);
    if (!friendship) {
        throw new NotFoundError("Friendship not found.");
    }

    // Either the requester or the receiver can remove the friendship
    if (friendship.requesterId !== userId && friendship.receiverId !== userId) {
        throw new UnauthorizedError("Not authorized to remove this friend.");
    }

    const success = await deleteFriendshipInDb(friendship.id, userId);
    return { success };
}
