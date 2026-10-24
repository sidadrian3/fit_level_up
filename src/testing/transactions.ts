import type { ClientSession } from "mongodb";
import { clientPromise } from "@/server/platform/database";

export async function inTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const client = await clientPromise;
  const session = client.startSession();
  try {
    return (await session.withTransaction(() => work(session))) as T;
  } finally {
    await session.endSession();
  }
}
