import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function getAuthUserId(): Promise<string> {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: await headers()
    });
  } catch (error) {
    console.error("Failed to get session in getAuthUserId:", error);
  }

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}
