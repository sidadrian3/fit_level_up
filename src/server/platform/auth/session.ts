import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";

export async function getSessionUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.id ?? null;
  } catch (error) {
    console.error("Failed to get session in getSessionUserId:", error);
    return null;
  }
}
