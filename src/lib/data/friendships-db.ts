import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/data/get-collection";
import type { Friendship, FriendshipStatus } from "@/lib/types";

export type FriendshipMongoDoc = {
  _id?: ObjectId;
  requesterId: string;
  receiverId: string;
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

export async function insertFriendshipInDb(doc: Omit<FriendshipMongoDoc, "_id">): Promise<Friendship> {
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const result = await collection.insertOne(doc);
  return toFriendship({ ...doc, _id: result.insertedId });
}

export async function getFriendshipByIdFromDb(id: string): Promise<Friendship | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  return doc ? toFriendship(doc) : null;
}

export async function getFriendshipBetweenFromDb(userId: string, otherId: string): Promise<Friendship | null> {
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const doc = await collection.findOne(
    {
      $or: [
        { requesterId: userId, receiverId: otherId },
        { requesterId: otherId, receiverId: userId }
      ]
    },
    { sort: { createdAt: -1 } }
  );
  return doc ? toFriendship(doc) : null;
}

export async function updateFriendshipStatusInDb(id: string, status: FriendshipStatus, updatedAt: Date): Promise<Friendship | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { status, updatedAt } },
    { returnDocument: "after" }
  );
  return result ? toFriendship(result) : null;
}

export async function deleteFriendshipInDb(id: string, userId: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await getCollection<FriendshipMongoDoc>("friendshipsCollection");
  const result = await collection.deleteOne({
    _id: new ObjectId(id),
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
