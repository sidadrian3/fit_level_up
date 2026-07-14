import { getFriendshipByIdFromDb, deleteFriendshipInDb } from "@/lib/data/friendships-db";

export async function removeFriend(friendshipId: string, userId: string): Promise<{ success: boolean }> {
    const friendship = await getFriendshipByIdFromDb(friendshipId);
    if (!friendship) {
        throw new Error("Friendship not found.");
    }

    // Either the requester or the receiver can remove the friendship
    if (friendship.requesterId !== userId && friendship.receiverId !== userId) {
        throw new Error("Not authorized to remove this friend.");
    }

    const success = await deleteFriendshipInDb(friendshipId, userId);
    return { success };
}
