import type { PersonalRecord } from "@/shared/contracts/personal-record";
import { NotFoundError } from "@/server/platform/http";
import { getPersonalRecords } from "@/server/training";
import { findPair } from "./friendship.repository";

export async function getFriendRecords(userId: string, friendId: string): Promise<PersonalRecord[]> {
  const pair = await findPair(userId, friendId);
  if (pair?.status !== "accepted") throw new NotFoundError("Friend not found.");
  return getPersonalRecords(friendId);
}
