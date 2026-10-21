import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/data/get-collection";
import { parseObjectId } from "@/lib/data/object-id";
import { buildFriendshipPairKey } from "@/lib/domain/friend-rules";
import type { Friendship, FriendshipStatus } from "@/lib/types";

export type FriendshipMongoDoc = {
  _id?: ObjectId;
  requesterId: string;
  receiverId: string;
  pairKey: string;
  status: "pending" | "accepted" | "declined";
  createdAt: Date;
  updatedAt: Date;
};

export function toFriendship(doc: FriendshipMongoDoc): Friendship {
  return {
    id: doc._id!.toString(),
    requesterId: doc.requesterId,
    receiverId: doc.receiverId,
    status: doc.status as FriendshipStatus,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function insertFriendshipInDb(
  doc: Omit<FriendshipMongoDoc, "_id" | "pairKey">
): Promise<Friendship> {
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const withPairKey = { ...doc, pairKey: buildFriendshipPairKey(doc.requesterId, doc.receiverId) };
  const result = await collection.insertOne(withPairKey);
  return toFriendship({ ...withPairKey, _id: result.insertedId });
}

// Matches only a declined pair; any other existing pair hits the unique pairKey index (E11000)
export async function reopenOrInsertFriendRequestInDb(
  requesterId: string,
  receiverId: string,
  now: Date
): Promise<Friendship> {
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const result = await collection.findOneAndUpdate(
    { pairKey: buildFriendshipPairKey(requesterId, receiverId), status: "declined" },
    { $set: { requesterId, receiverId, status: "pending", createdAt: now, updatedAt: now } },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) {
    throw new Error("Friend request upsert returned no document");
  }
  return toFriendship(result);
}

export async function getFriendshipByIdFromDb(id: string): Promise<Friendship | null> {
  const _id = parseObjectId(id);
  if (!_id) return null;
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const doc = await collection.findOne({ _id });
  return doc ? toFriendship(doc) : null;
}

export async function getFriendshipBetweenFromDb(userId: string, otherId: string): Promise<Friendship | null> {
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const doc = await collection.findOne({ pairKey: buildFriendshipPairKey(userId, otherId) });
  return doc ? toFriendship(doc) : null;
}

export async function updateFriendshipStatusInDb(id: string, status: FriendshipStatus, updatedAt: Date): Promise<Friendship | null> {
  const _id = parseObjectId(id);
  if (!_id) return null;
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const result = await collection.findOneAndUpdate(
    { _id },
    { $set: { status, updatedAt } },
    { returnDocument: "after" }
  );
  return result ? toFriendship(result) : null;
}

export async function deleteFriendshipInDb(id: string, userId: string): Promise<boolean> {
  const _id = parseObjectId(id);
  if (!_id) return false;
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const result = await collection.deleteOne({
    _id,
    $or: [{ requesterId: userId }, { receiverId: userId }]
  });
  return result.deletedCount === 1;
}

export async function getAcceptedFriendIdsFromDb(userId: string): Promise<string[]> {
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const docs = await collection.find({
    status: "accepted",
    $or: [{ requesterId: userId }, { receiverId: userId }]
  }).toArray();

  return docs.map((doc) => (doc.requesterId === userId ? doc.receiverId : doc.requesterId));
}

export async function getPendingIncomingRequestsFromDb(userId: string): Promise<Friendship[]> {
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const docs = await collection.find({
    receiverId: userId,
    status: "pending"
  }).toArray();

  return docs.map(toFriendship);
}

export async function getAcceptedFriendshipsFromDb(userId: string): Promise<Friendship[]> {
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const docs = await collection.find({
    status: "accepted",
    $or: [{ requesterId: userId }, { receiverId: userId }]
  }).toArray();

  return docs.map(toFriendship);
}
