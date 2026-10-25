import type { ClientSession } from "mongodb";
import { getCollection, MAX_FIND_LIMIT, type FriendshipDoc } from "@/server/platform/database";
import type { Friendship } from "@/lib/types";
import { buildFriendshipPairKey, type FriendshipStatus } from "./friendship.rules";

// friendships has no userId field, so each function takes the acting user and scopes by pairKey or participant.

export function toFriendship(doc: FriendshipDoc): Friendship {
  return {
    id: doc._id!.toString(),
    requesterId: doc.requesterId,
    receiverId: doc.receiverId,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function findPair(actorId: string, otherId: string, session?: ClientSession): Promise<FriendshipDoc | null> {
  const friendships = await getCollection<FriendshipDoc>("friendships");
  return friendships.findOne({ pairKey: buildFriendshipPairKey(actorId, otherId) }, { session });
}

// Matches only a declined pair; any other existing pair hits the unique pairKey index (E11000)
export async function reopenOrInsertRequest(
  requesterId: string,
  receiverId: string,
  now: Date,
  session: ClientSession,
): Promise<FriendshipDoc> {
  const friendships = await getCollection<FriendshipDoc>("friendships");
  const result = await friendships.findOneAndUpdate(
    { pairKey: buildFriendshipPairKey(requesterId, receiverId), status: "declined" },
    { $set: { requesterId, receiverId, status: "pending", createdAt: now, updatedAt: now } },
    { upsert: true, returnDocument: "after", session },
  );
  if (!result) throw new Error("Friend request upsert returned no document");
  return result;
}

// The expected status makes the flip atomic; null means the pair changed since it was read.
export async function setStatus(
  actorId: string,
  otherId: string,
  expectedStatus: FriendshipStatus,
  status: FriendshipStatus,
  now: Date,
  session?: ClientSession,
): Promise<FriendshipDoc | null> {
  const friendships = await getCollection<FriendshipDoc>("friendships");
  return friendships.findOneAndUpdate(
    { pairKey: buildFriendshipPairKey(actorId, otherId), status: expectedStatus },
    { $set: { status, updatedAt: now } },
    { returnDocument: "after", session },
  );
}

// Declined pairs are never deleted: the tombstone carries the re-request cooldown.
export async function deletePair(actorId: string, otherId: string): Promise<boolean> {
  const friendships = await getCollection<FriendshipDoc>("friendships");
  const result = await friendships.deleteOne({
    pairKey: buildFriendshipPairKey(actorId, otherId),
    status: { $in: ["pending", "accepted"] },
  });
  return result.deletedCount === 1;
}

export async function findAccepted(userId: string): Promise<FriendshipDoc[]> {
  const friendships = await getCollection<FriendshipDoc>("friendships");
  return friendships
    .find({ status: "accepted", $or: [{ requesterId: userId }, { receiverId: userId }] })
    .limit(MAX_FIND_LIMIT)
    .toArray();
}

export async function findIncomingPending(userId: string): Promise<FriendshipDoc[]> {
  const friendships = await getCollection<FriendshipDoc>("friendships");
  return friendships.find({ receiverId: userId, status: "pending" }).limit(MAX_FIND_LIMIT).toArray();
}
