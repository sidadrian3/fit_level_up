import type { Friendship } from "@/lib/types";
import { getFriendshipByIdFromDb, updateFriendshipStatusInDb } from "@/lib/data/friendships-db";
import { getUserFromDb } from "@/lib/data/user-db";
import { sseRegistry } from "@/lib/sse/sse-registry";

export async function acceptFriendRequest(friendshipId: string, userId: string): Promise<Friendship> {
    // 1. Fetch existing request
    const friendship = await getFriendshipByIdFromDb(friendshipId);
    if (!friendship) {
        throw new Error("Friend request not found.");
    }

    // 2. Validate state
    if (friendship.status !== "pending") {
        throw new Error("Friend request is not pending.");
    }

    // 3. Authorize (only the receiver can accept)
    if (friendship.receiverId !== userId) {
        throw new Error("Not authorized to respond to this request.");
    }

    // 4. Update status in database
    const updated = await updateFriendshipStatusInDb(friendshipId, "accepted", new Date());
    if (!updated) {
        throw new Error("Failed to accept friend request.");
    }

    // 5. Side Effects (Fire-and-forget real-time notification to the original requester)
    // We fetch the current user to get their name and avatar for the notification payload.
    getUserFromDb(userId).then(user => {
        if (user) {
            sseRegistry.notify(updated.requesterId, {
                type: "friend_accepted",
                payload: {
                    actorId: user.id,
                    actorName: user.name,
                    actorAvatar: user.avatar,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }).catch(err => {
        console.error("Failed to send friend_accepted SSE:", err);
    });

    return updated;
}
