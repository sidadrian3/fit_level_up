import type { Friendship } from "@/lib/types";
import { getAccounts } from "@/server/platform/auth";
import { clientPromise, isDuplicateKeyError } from "@/server/platform/database";
import { GAME_CONFIG } from "@/server/platform/config";
import { emit } from "@/server/platform/events";
import { ConflictError, NotFoundError } from "@/server/platform/http";
import { checkFriendshipTransition, validateFriendRequest } from "./friendship.rules";
import { findPair, reopenOrInsertRequest, toFriendship } from "./friendship.repository";
import "./events";

const ALREADY_SENT = "Friend request already sent.";

export async function sendFriendRequest(
  requesterId: string,
  receiverId: string,
  now: Date = new Date(),
): Promise<Friendship> {
  validateFriendRequest(requesterId, receiverId);

  const accounts = await getAccounts([receiverId, requesterId]);
  if (!accounts.some((account) => account.id === receiverId)) throw new NotFoundError("User not found.");
  if (!accounts.some((account) => account.id === requesterId)) throw new NotFoundError("Requester not found.");

  const existing = await findPair(requesterId, receiverId);
  if (existing?.status === "declined") {
    const verdict = checkFriendshipTransition(
      "reopen",
      existing,
      requesterId,
      now,
      GAME_CONFIG.social.friendRequestCooldownDays,
    );
    if (verdict === "coolingDown") throw new ConflictError(ALREADY_SENT);
  }

  const client = await clientPromise;
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const doc = await reopenOrInsertRequest(requesterId, receiverId, now, session);
      const friendship = toFriendship(doc);
      await emit("friendship.requested", { friendshipId: friendship.id, requesterId, receiverId }, { session });
      return friendship;
    });
  } catch (error: unknown) {
    if (isDuplicateKeyError(error, "pairKey")) throw new ConflictError(ALREADY_SENT);
    throw error;
  } finally {
    await session.endSession();
  }
}
