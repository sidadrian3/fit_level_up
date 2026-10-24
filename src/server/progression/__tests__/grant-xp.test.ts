import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ClientSession } from "mongodb";
import { grantXp } from "../grant-xp";
import {
  clientPromise,
  getCollection,
  type XpLedgerDoc,
} from "@/server/platform/database";
import { deletePlayer, seedPlayer } from "@/testing/players";

async function inTransaction<T>(
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

const outbox = async () => getCollection("outbox");
const ledgerRows = async (userId: string) =>
  (await getCollection<XpLedgerDoc>("xpLedger")).find({ userId }).toArray();

describe("grantXp", () => {
  let userId: string;
  const grant = (amount: number, id = "quest-1") => ({
    userId,
    source: { type: "quest_claim" as const, id },
    amount,
    occurredAt: new Date(),
  });

  beforeEach(async () => {
    await (await outbox()).deleteMany({});
    userId = await seedPlayer({ profile: { totalXp: 450 } });
  });

  afterEach(async () => {
    await deletePlayer(userId);
    await (await outbox()).deleteMany({});
  });

  it("levels up, writes one ledger row and emits one event", async () => {
    const { player, leveledUp } = await inTransaction((session) =>
      grantXp(grant(100), session),
    );

    expect(leveledUp).toBe(true);
    expect(player).toMatchObject({ level: 2, xp: 50, totalXp: 550 });
    const rows = await ledgerRows(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sourceType: "quest_claim",
      sourceId: "quest-1",
      amount: 100,
    });
    const events = await (await outbox())
      .find({ type: "progression.leveled-up" })
      .toArray();
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({
      userId,
      previousLevel: 1,
      newLevel: 2,
    });
  });

  it("emits nothing below the threshold", async () => {
    const { leveledUp } = await inTransaction((session) =>
      grantXp(grant(10), session),
    );

    expect(leveledUp).toBe(false);
    expect(await (await outbox()).countDocuments({})).toBe(0);
  });

  it("leaves no ledger row, xp or event when the transaction aborts", async () => {
    await expect(
      inTransaction(async (session) => {
        await grantXp(grant(100), session);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    expect(await ledgerRows(userId)).toHaveLength(0);
    expect(await (await outbox()).countDocuments({})).toBe(0);
    const profile = await (
      await getCollection("playerProfiles")
    ).findOne({ _id: userId as never });
    expect(profile?.totalXp).toBe(450);
  });

  it("rejects a duplicate source", async () => {
    await inTransaction((session) => grantXp(grant(10), session));

    await expect(
      inTransaction((session) => grantXp(grant(10), session)),
    ).rejects.toThrow();
    expect(await ledgerRows(userId)).toHaveLength(1);
  });

  it("emits one event carrying the final level for a multi-level grant", async () => {
    await inTransaction((session) => grantXp(grant(2000), session));

    const events = await (await outbox())
      .find({ type: "progression.leveled-up" })
      .toArray();
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ previousLevel: 1, newLevel: 3 });
  });

  it("sums totalXp for parallel grants on one profile", async () => {
    await Promise.all([
      inTransaction((session) => grantXp(grant(10, "a"), session)),
      inTransaction((session) => grantXp(grant(20, "b"), session)),
    ]);

    expect(await ledgerRows(userId)).toHaveLength(2);
    const profile = await (
      await getCollection("playerProfiles")
    ).findOne({ _id: userId as never });
    expect(profile?.totalXp).toBe(480);
  });

  it("survives two parallel first-touch grants on a player with no profile", async () => {
    const fresh = await seedPlayer();
    try {
      await Promise.all([
        inTransaction(session => grantXp({ ...grant(10, "a"), userId: fresh }, session)),
        inTransaction(session => grantXp({ ...grant(20, "b"), userId: fresh }, session)),
      ]);
      const profile = await (await getCollection("playerProfiles")).findOne({ _id: fresh as never });
      expect(profile?.totalXp).toBe(30);
    } finally {
      await deletePlayer(fresh);
    }
  });

  it("creates the profile on a first grant", async () => {
    const fresh = await seedPlayer();
    try {
      const { player } = await inTransaction((session) =>
        grantXp({ ...grant(30), userId: fresh }, session),
      );
      expect(player).toMatchObject({
        totalXp: 30,
        level: 1,
        stamina: 100,
        streak: 0,
      });
    } finally {
      await deletePlayer(fresh);
    }
  });
});
