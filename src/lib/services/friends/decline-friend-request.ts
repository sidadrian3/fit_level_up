import type { Friendship } from "@/lib/types";
import { getFriendshipBetweenFromDb, updateFriendshipStatusInDb } from "@/lib/data/friendships-db";

export async function declineFriendRequest(targetUserId: string, userId: string): Promise<Friendship> {
    // 1. Fetch existing request between the two users
    const friendship = await getFriendshipBetweenFromDb(userId, targetUserId);
    if (!friendship) {
        throw new Error("Friend request not found.");
    }

    // 2. Validate state
    if (friendship.status !== "pending") {
        throw new Error("Friend request is not pending.");
    }

    // 3. Authorize (only the receiver can decline)
    if (friendship.receiverId !== userId) {
        throw new Error("Not authorized to respond to this request.");
    }

    // 4. Update status in database (tombstone) using the fetched friendship's ID
    const updated = await updateFriendshipStatusInDb(friendship.id, "declined", new Date());
    if (!updated) {
        throw new Error("Failed to decline friend request.");
    }

    // 5. Side Effects: None. Declining is a silent action.

    return updated;
}
