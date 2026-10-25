import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { replaceSourceXp } from "../progression.service";
import {
  getCollection,
  type PlayerProfileDoc,
} from "@/server/platform/database";
import { deletePlayer, seedPlayer } from "@/testing/players";
import { inTransaction } from "@/testing/transactions";

const NOW = new Date("2026-03-10T12:00:00Z");

const outbox = async () => getCollection("outbox");
const ledgerRows = async (userId: string) =>
  (await getCollection("xpLedger")).find({ userId }).toArray();
const storedProfile = async (userId: string) =>
  (await getCollection<PlayerProfileDoc>("playerProfiles")).findOne({
    _id: userId,
  });

async function seedRow(
  userId: string,
  type: string,
  id: string,
  amount: number,
) {
  await (await getCollection("xpLedger")).insertOne({
    userId,
    sourceType: type,
    sourceId: id,
    amount,
    occurredAt: NOW,
    createdAt: NOW,
  } as never);
}

describe("replaceSourceXp", () => {
  let userId: string;

  const replace = (
    amount: number,
    totals: { workouts?: number; distanceKm?: number } = {},
  ) =>
    inTransaction((session) =>
      replaceSourceXp(
        {
          userId,
          source: { type: "workout", id: "w1" },
          amount,
          occurredAt: NOW,
          totals,
        },
        session,
      ),
    );

  beforeEach(async () => {
    await (await outbox()).deleteMany({});
  });

  afterEach(async () => {
    await deletePlayer(userId);
    await (await outbox()).deleteMany({});
  });

  it("replaces the row and re-sums, levelling down", async () => {
    userId = await seedPlayer({ profile: { totalXp: 600, highestLevel: 2 } });
    await seedRow(userId, "workout", "w1", 550);
    await seedRow(userId, "quest_claim", "q1", 50);

    const { player, leveledUp } = await replace(100);

    const rows = await ledgerRows(userId);
    expect(rows.filter((r) => r.sourceId === "w1")).toHaveLength(1);
    expect(rows.find((r) => r.sourceId === "w1")?.amount).toBe(100);
    expect((await storedProfile(userId))?.totalXp).toBe(150);
    expect(player.level).toBe(1);
    expect(leveledUp).toBe(false);
    expect(await (await outbox()).countDocuments({})).toBe(0);
  });

  it("levels up past the highest level once", async () => {
    userId = await seedPlayer({ profile: { totalXp: 100, highestLevel: 1 } });
    await seedRow(userId, "workout", "w1", 100);

    const { leveledUp } = await replace(600);

    expect(leveledUp).toBe(true);
    expect(
      await (await outbox()).countDocuments({ type: "progression.leveled-up" }),
    ).toBe(1);
    expect((await storedProfile(userId))?.highestLevel).toBe(2);
  });

  it("inserts the row when it is missing", async () => {
    userId = await seedPlayer({ profile: { totalXp: 750 } });

    await replace(80);

    expect(await ledgerRows(userId)).toHaveLength(1);
    expect((await storedProfile(userId))?.totalXp).toBe(80);
  });

  it("applies the distance delta", async () => {
    userId = await seedPlayer({ profile: { totalDistance: 10 } });

    await replace(80, { distanceKm: -2.5 });

    expect((await storedProfile(userId))?.totalDistance).toBe(7.5);
  });
});
