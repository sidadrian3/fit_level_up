import "server-only";
import type { ClientSession } from "mongodb";
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

export async function getAccount(userId: string, { session }: AccountOptions = {}): Promise<Account | null> {
  const _id = parseObjectId(userId);
  if (!_id) return null;
  const users = await getCollection<UserDoc>("user");
  const doc = await users.findOne({ _id }, { session });
  if (!doc) return null;
  return {
    id: _id.toString(),
    email: doc.email || "",
    name: doc.name || "",
    avatar: doc.avatar || doc.image || "zap",
    joinDate: new Date(doc.createdAt || Date.now()).toISOString().slice(0, 10),
    timeZone: doc.timeZone ?? "UTC",
  };
}
