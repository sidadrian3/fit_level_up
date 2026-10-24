import "server-only";
import type { ClientSession, WithId } from "mongodb";
import { getCollection, parseObjectId, type UserDoc } from "@/server/platform/database";

export type Account = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  joinDate: string;
  timeZone: string;
};

type AccountOptions = { session?: ClientSession };

export async function getUserTimeZone(userId: string, { session }: AccountOptions = {}): Promise<string> {
  const _id = parseObjectId(userId);
  if (!_id) return "UTC";
  const users = await getCollection<UserDoc>("user");
  const doc = await users.findOne({ _id }, { session, projection: { timeZone: 1 } });
  return doc?.timeZone ?? "UTC";
}

function toAccount(doc: WithId<UserDoc>): Account {
  return {
    id: doc._id.toString(),
    email: doc.email || "",
    name: doc.name || "",
    avatar: doc.avatar || doc.image || "zap",
    joinDate: new Date(doc.createdAt || Date.now()).toISOString().slice(0, 10),
    timeZone: doc.timeZone ?? "UTC",
  };
}

export async function getAccount(userId: string, { session }: AccountOptions = {}): Promise<Account | null> {
  const _id = parseObjectId(userId);
  if (!_id) return null;
  const users = await getCollection<UserDoc>("user");
  const doc = await users.findOne({ _id }, { session });
  return doc && toAccount(doc);
}

export async function getAccounts(userIds: string[], { session }: AccountOptions = {}): Promise<Account[]> {
  const ids = userIds.flatMap((userId) => parseObjectId(userId) ?? []);
  if (ids.length === 0) return [];
  const users = await getCollection<UserDoc>("user");
  const docs = await users.find({ _id: { $in: ids } }, { session }).toArray();
  return docs.map(toAccount);
}
