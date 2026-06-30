import type { User } from "@/lib/types";
import { getUserFromDb } from "@/lib/data/user-db";
import { syncUserStreak } from "@/lib/services/users/sync-user-streak";

export async function getUser(userId: string): Promise<User> {
  await syncUserStreak(userId);
  return getUserFromDb(userId);
}
