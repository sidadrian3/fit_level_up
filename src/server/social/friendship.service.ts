import type { FriendProfile, Friendship } from "@/lib/types";
import { getAccounts } from "@/server/platform/auth";
import { clientPromise, isDuplicateKeyError, type FriendshipDoc } from "@/server/platform/database";
import { GAME_CONFIG } from "@/server/platform/config";
import { emit } from "@/server/platform/events";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/platform/http";
import { checkFriendshipTransition, validateFriendRequest } from "./friendship.rules";
import {
  deletePair,
  findAccepted,
  findIncomingPending,
  findPair,
  reopenOrInsertRequest,
  setStatus,
  toFriendship,
} from "./friendship.repository";
import { getPlayerStates } from "@/server/progression";
import type { PersonalRecord } from "@/shared/contracts/personal-record";
import { getPersonalRecords } from "@/server/training";
import "./friendship.events";

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

export async function removeFriend(targetUserId: string, userId: string): Promise<{ success: boolean }> {
  const friendship = await findPair(userId, targetUserId);
  if (!friendship) throw new NotFoundError("Friendship not found.");

  const verdict = checkFriendshipTransition(
    "remove",
    friendship,
    userId,
    new Date(),
    GAME_CONFIG.social.friendRequestCooldownDays,
  );
  if (verdict === "wrongState") throw new NotFoundError("Friendship not found.");
  if (verdict === "notAllowed") throw new ForbiddenError("Not authorized to remove this friend.");

  return { success: await deletePair(userId, targetUserId) };
}

function otherParty(friendship: FriendshipDoc, userId: string): string {
  return friendship.requesterId === userId ? friendship.receiverId : friendship.requesterId;
}

async function toProfiles(
  friendships: FriendshipDoc[],
  otherPartyId: (friendship: FriendshipDoc) => string,
): Promise<FriendProfile[]> {
  const accounts = await getAccounts(friendships.map(otherPartyId));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const playerById = await getPlayerStates(accounts.map((account) => ({ userId: account.id, timeZone: account.timeZone })));

  return friendships.flatMap((friendship) => {
    const account = accountById.get(otherPartyId(friendship));
    const player = account && playerById.get(account.id);
    if (!account || !player) return [];
    return {
      userId: account.id,
      name: account.name,
      avatar: account.avatar,
      level: player.level,
      streak: player.streak,
      totalWorkouts: player.totalWorkouts,
      totalDistance: player.totalDistance,
      friendship: toFriendship(friendship),
    };
  });
}

export async function listFriends(userId: string): Promise<FriendProfile[]> {
  const friendships = await findAccepted(userId);
  const profiles = await toProfiles(friendships, (friendship) => otherParty(friendship, userId));
  return profiles.sort((a, b) => b.level - a.level);
}

export async function listFriendRequests(userId: string): Promise<FriendProfile[]> {
  const requests = await findIncomingPending(userId);
  const profiles = await toProfiles(requests, (friendship) => friendship.requesterId);
  return profiles.sort((a, b) => b.friendship.createdAt.localeCompare(a.friendship.createdAt));
}

export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const friendships = await findAccepted(userId);
  return friendships.map((friendship) => otherParty(friendship, userId));
}

export async function getFriendRecords(userId: string, friendId: string): Promise<PersonalRecord[]> {
  const pair = await findPair(userId, friendId);
  if (pair?.status !== "accepted") throw new NotFoundError("Friend not found.");
  return getPersonalRecords(friendId);
}
