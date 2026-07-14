import type { Friendship } from "@/lib/types";
import { getFriendshipByIdFromDb, updateFriendshipStatusInDb } from "@/lib/data/friendships-db";

export async function declineFriendRequest(friendshipId: string, userId: string): Promise<Friendship> {
    // 1. Fetch existing request
    const friendship = await getFriendshipByIdFromDb(friendshipId);
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

    // 4. Update status in database (tombstone)
    const updated = await updateFriendshipStatusInDb(friendshipId, "declined", new Date());
    if (!updated) {
        throw new Error("Failed to decline friend request.");
    }

    // 5. Side Effects: None. Declining is a silent action.

    return updated;
}
