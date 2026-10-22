import { getSessionUserId } from "@/server/platform/auth";
import { UnauthorizedError } from "@/server/platform/http";

export async function getAuthUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new UnauthorizedError("Unauthorized");
  }
  return userId;
}
