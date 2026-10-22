import type { Friendship } from "@/lib/types";
import { validateFriendRequest } from "@/lib/domain/friend-rules";
import { UserStateService } from "@/lib/services/users/user-state.service";
import { reopenOrInsertFriendRequestInDb } from "@/lib/data/friendships-db";
import { isDuplicateKeyError } from "@/server/platform/database";
import { publishToUser } from "@/lib/sse/sse-publisher";
import { after } from "next/server";
import { NotFoundError, ConflictError } from "@/lib/api/errors";


export async function sendFriendRequest(requesterId: string, receiverId: string): Promise<Friendship> {
    validateFriendRequest(requesterId, receiverId);

    const receiver = await UserStateService.getUser(receiverId);
    if (!receiver) {
        throw new NotFoundError("User not found.");
    }

    const requester = await UserStateService.getUser(requesterId);
    if (!requester) {
        throw new NotFoundError("Requester not found.");
    }

    let friendshipObj: Friendship;
    try {
        friendshipObj = await reopenOrInsertFriendRequestInDb(requesterId, receiverId, new Date());
    } catch (error: unknown) {
        if (isDuplicateKeyError(error, "pairKey")) {
            throw new ConflictError("Friend request already sent.");
        }
        throw error;
    }

    // 2. Side Effects (fire-and-forget via Redis queue)
    after(
        publishToUser(receiverId, {
            type: "friend_request",
            payload: {
                actorId: friendshipObj.requesterId,
                actorName: requester.name,
                actorAvatar: requester.avatar,
                timestamp: new Date().toISOString()
            },
        }).catch(err => console.error("[SSE] Failed to publish friend_request:", err))
    );

    return friendshipObj;
}