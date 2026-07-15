import { getFriendshipBetweenFromDb, deleteFriendshipInDb } from "@/lib/data/friendships-db";

export async function removeFriend(targetUserId: string, userId: string): Promise<{ success: boolean }> {
    const friendship = await getFriendshipBetweenFromDb(userId, targetUserId);
    if (!friendship) {
        throw new Error("Friendship not found.");
    }

    // Either the requester or the receiver can remove the friendship
    if (friendship.requesterId !== userId && friendship.receiverId !== userId) {
        throw new Error("Not authorized to remove this friend.");
    }

    const success = await deleteFriendshipInDb(friendship.id, userId);
    return { success };
}
