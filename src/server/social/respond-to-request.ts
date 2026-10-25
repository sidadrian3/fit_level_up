import type { Friendship } from "@/lib/types";
import { clientPromise } from "@/server/platform/database";
import { GAME_CONFIG } from "@/server/platform/config";
import { emit } from "@/server/platform/events";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/platform/http";
import { checkFriendshipTransition } from "./friendship.rules";
import { findPair, setStatus, toFriendship } from "./friendship.repository";
import "./events";

async function requirePendingRequestTo(userId: string, targetUserId: string, action: "accept" | "decline") {
  const friendship = await findPair(userId, targetUserId);
  if (!friendship) throw new NotFoundError("Friend request not found.");

  const verdict = checkFriendshipTransition(
    action,
    friendship,
    userId,
    new Date(),
    GAME_CONFIG.social.friendRequestCooldownDays,
  );
  if (verdict === "wrongState") throw new ConflictError("Friend request is not pending.");
  if (verdict === "notAllowed") throw new ForbiddenError("Not authorized to respond to this request.");
  return friendship;
}

export async function acceptFriendRequest(targetUserId: string, userId: string): Promise<Friendship> {
  const pending = await requirePendingRequestTo(userId, targetUserId, "accept");

  const client = await clientPromise;
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const updated = await setStatus(userId, targetUserId, "pending", "accepted", new Date(), session);
      if (!updated) throw new ConflictError("Friend request is not pending.");
      const friendship = toFriendship(updated);
      await emit(
        "friendship.accepted",
        { friendshipId: friendship.id, requesterId: pending.requesterId, receiverId: pending.receiverId },
        { session },
      );
      return friendship;
    });
  } finally {
    await session.endSession();
  }
}

export async function declineFriendRequest(targetUserId: string, userId: string): Promise<Friendship> {
  await requirePendingRequestTo(userId, targetUserId, "decline");

  const updated = await setStatus(userId, targetUserId, "pending", "declined", new Date());
  if (!updated) throw new ConflictError("Friend request is not pending.");
  return toFriendship(updated);
}
