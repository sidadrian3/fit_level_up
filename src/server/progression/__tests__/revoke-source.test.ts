import { describe, it, expect, afterEach, vi } from "vitest";
import { revokeSource, type ActivityDays } from "../revoke-source";
import {
  getCollection,
  type PlayerProfileDoc,
} from "@/server/platform/database";
import { deletePlayer, seedPlayer } from "@/testing/players";
import { inTransaction } from "@/testing/transactions";

const storedProfile = async (userId: string) =>
  (await getCollection<PlayerProfileDoc>("playerProfiles")).findOne({
    _id: userId,
  });

async function seedRow(userId: string, id: string, amount: number) {
  const now = new Date();
  await (await getCollection("xpLedger")).insertOne({
    userId,
    sourceType: "workout",
    sourceId: id,
    amount,
    occurredAt: now,
    createdAt: now,
  } as never);
}

function daysOf(days: string[], latest: string | null = null) {
  return {
    since: vi.fn(async (from: string) => days.filter((day) => day >= from)),
    latest: vi.fn(async () => latest),
  } satisfies ActivityDays;
}

describe("revokeSource", () => {
  let userId: string;

  afterEach(async () => {
    await deletePlayer(userId);
    await (await getCollection("outbox")).deleteMany({});
  });

  const revoke = (
    occurredAt: string,
    activityDays?: ActivityDays,
    totals: { workouts?: number; distanceKm?: number } = {},
  ) =>
    inTransaction((session) =>
      revokeSource(
        {
          userId,
          source: { type: "workout", id: "w1" },
          occurredAt: new Date(occurredAt),
          totals,
          activityDays,
        },
        session,
      ),
    );

  const seedStreak = async (streak: number, lastActivityDay: string) => {
    userId = await seedPlayer({
      timeZone: "UTC",
      profile: { streak, lastActivityDay },
    });
  };

  it("removes the row, re-sums and applies totals", async () => {
    userId = await seedPlayer({ profile: { totalXp: 500, totalWorkouts: 2 } });
    await seedRow(userId, "w1", 300);
    await seedRow(userId, "w2", 200);

    await revoke("2026-03-10T12:00:00Z", undefined, { workouts: -1 });

    expect(await storedProfile(userId)).toMatchObject({
      totalXp: 200,
      totalWorkouts: 1,
    });
    expect(await (await getCollection("outbox")).countDocuments({})).toBe(0);
  });

  it("tolerates a missing row", async () => {
    userId = await seedPlayer({ profile: { totalXp: 500 } });

    await revoke("2026-03-10T12:00:00Z");

    expect((await storedProfile(userId))?.totalXp).toBe(0);
  });

  it("recounts a streak broken in the middle", async () => {
    await seedStreak(5, "2026-03-10");

    await revoke(
      "2026-03-08T12:00:00Z",
      daysOf(["2026-03-06", "2026-03-07", "2026-03-09", "2026-03-10"]),
    );

    expect(await storedProfile(userId)).toMatchObject({
      streak: 2,
      lastActivityDay: "2026-03-10",
    });
  });

  it("keeps the streak when another activity shares the day", async () => {
    await seedStreak(5, "2026-03-10");

    await revoke(
      "2026-03-08T12:00:00Z",
      daysOf([
        "2026-03-06",
        "2026-03-07",
        "2026-03-08",
        "2026-03-09",
        "2026-03-10",
      ]),
    );

    expect(await storedProfile(userId)).toMatchObject({
      streak: 5,
      lastActivityDay: "2026-03-10",
    });
  });

  it("keeps the streak when the day is outside the window", async () => {
    await seedStreak(5, "2026-03-10");
    const activityDays = daysOf([]);

    await revoke("2026-03-01T12:00:00Z", activityDays);

    expect(activityDays.since).not.toHaveBeenCalled();
    expect(await storedProfile(userId)).toMatchObject({
      streak: 5,
      lastActivityDay: "2026-03-10",
    });
  });

  it("falls back to the latest activity when the window empties", async () => {
    await seedStreak(1, "2026-03-10");
    await revoke("2026-03-10T12:00:00Z", daysOf([], "2026-03-02"));
    expect(await storedProfile(userId)).toMatchObject({
      streak: 1,
      lastActivityDay: "2026-03-02",
    });
    await deletePlayer(userId);

    await seedStreak(1, "2026-03-10");
    await revoke("2026-03-10T12:00:00Z", daysOf([], null));
    expect(await storedProfile(userId)).toMatchObject({
      streak: 0,
      lastActivityDay: null,
    });
  });

  it("does not touch the streak without activityDays", async () => {
    await seedStreak(5, "2026-03-10");

    await revoke("2026-03-08T12:00:00Z");

    expect(await storedProfile(userId)).toMatchObject({
      streak: 5,
      lastActivityDay: "2026-03-10",
    });
  });
});
