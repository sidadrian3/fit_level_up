import type { User } from "@/lib/types";
import { getUserFromDb } from "@/lib/data/user-db";

export async function getUser(userId: string): Promise<User> {
  return getUserFromDb(userId);
}
