import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ObjectId, type ClientSession } from "mongodb";
import { grantUserXP } from "../users/grant-user-xp";
import { clientPromise, getCollection, type UserDoc } from "@/server/platform/database";

describe("grantUserXP events", () => {
  let userId: string;

  async function inTransaction(work: (session: ClientSession) => Promise<unknown>) {
    const client = await clientPromise;
    const session = client.startSession();
    try {
      await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  }

  beforeEach(async () => {
    await (await getCollection("outbox")).deleteMany({});
    const usersCol = await getCollection<UserDoc>("user");
    const { insertedId } = await usersCol.insertOne({
      email: "grant@example.com", name: "Grant", level: 1, xp: 450, xpToNextLevel: 500, streak: 0,
      totalWorkouts: 0, totalDistance: 0, stamina: 100, lastStaminaUpdate: new Date(), createdAt: new Date(),
    });
    userId = insertedId.toString();
  });

  afterEach(async () => {
    await (await getCollection<UserDoc>("user")).deleteOne({ _id: new ObjectId(userId) });
    await (await getCollection("outbox")).deleteMany({});
  });

  it("emits progression.leveled-up when the grant crosses a level", async () => {
    await inTransaction(session => grantUserXP(userId, 100, session));

    const rows = await (await getCollection("outbox")).find({ type: "progression.leveled-up" }).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual({ userId, previousLevel: 1, newLevel: 2 });
  });

  it("emits nothing below the threshold", async () => {
    await inTransaction(session => grantUserXP(userId, 10, session));

    expect(await (await getCollection("outbox")).countDocuments({})).toBe(0);
  });

  it("emits nothing when the transaction aborts", async () => {
    await expect(
      inTransaction(async session => {
        await grantUserXP(userId, 100, session);
        throw new Error("abort");
      })
    ).rejects.toThrow("abort");

    expect(await (await getCollection("outbox")).countDocuments({})).toBe(0);
  });
});
