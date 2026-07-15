import type { Friendship } from "@/lib/types";
import { validateFriendRequest } from "@/lib/domain/friend-rules";
import { getUserFromDb } from "@/lib/data/user-db";
import { getFriendshipBetweenFromDb, insertFriendshipInDb } from "@/lib/data/friendships-db";
import { sseRegistry } from "@/lib/sse/sse-registry";

export async function sendFriendRequest(requesterId: string, receiverId: string): Promise<Friendship> {
    validateFriendRequest(requesterId, receiverId);

    const receiver = await getUserFromDb(receiverId);
    if (!receiver) {
        throw new Error("User not found.");
    }

    const requester = await getUserFromDb(requesterId);
    if (!requester) {
        throw new Error("Requester not found.");
    }

    const existing = await getFriendshipBetweenFromDb(receiverId, requesterId);
    if (existing && existing.status !== "declined") {
        throw new Error("Friend request already sent.");
    }

    let friendshipObj: Friendship;
    try {
        friendshipObj = await insertFriendshipInDb({
            requesterId,
            receiverId,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    } catch (error: unknown) {
        const err = error as { code?: number; keyPattern?: { requesterId?: string } };
        if (err.code === 11000 && err.keyPattern?.requesterId) {
            console.log("Duplicate friend request ignored safely.");
            throw new Error("This friend request was already sent.");
        }
        throw error;
    }

    // 2. Side Effects (async)
    sseRegistry.notify(receiverId, {
        type: "friend_request",
        payload: {
            actorId: friendshipObj.requesterId,
            actorName: requester.name,
            actorAvatar: requester.avatar,
            timestamp: new Date().toISOString()
        },
    });

    return friendshipObj;
}