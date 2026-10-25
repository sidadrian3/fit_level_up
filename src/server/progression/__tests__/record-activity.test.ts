import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { recordActivity } from "../progression.service";
import {
  getCollection,
  type PlayerProfileDoc,
  type XpLedgerDoc,
} from "@/server/platform/database";
import { deletePlayer, seedPlayer } from "@/testing/players";
import { inTransaction } from "@/testing/transactions";

const MANILA = "Asia/Manila";
// 2026-03-10 12:00 in Manila
const NOW = new Date("2026-03-10T04:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const storedProfile = async (userId: string) =>
  (await getCollection<PlayerProfileDoc>("playerProfiles")).findOne({
    _id: userId,
  });

describe("recordActivity", () => {
  const created: string[] = [];
  let sourceCounter = 0;

  async function player(profile?: Partial<PlayerProfileDoc>) {
    const id = await seedPlayer({ timeZone: MANILA, profile });
    created.push(id);
    return id;
  }

  const record = (
    userId: string,
    overrides: Partial<Parameters<typeof recordActivity>[0]> = {},
  ) =>
    inTransaction((session) =>
      recordActivity(
        {
          userId,
          source: { type: "workout", id: `w-${sourceCounter++}` },
          xp: 40,
          staminaCost: 10,
          totals: { workouts: 1 },
          occurredAt: NOW,
          ...overrides,
        },
        session,
      ),
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await (await getCollection("outbox")).deleteMany({});
    await Promise.all(created.splice(0).map(deletePlayer));
  });

  it("creates a default profile with the activity applied on first touch", async () => {
    const userId = await player();

    const { player: state } = await record(userId, {
      totals: { workouts: 1, distanceKm: 5 },
    });

    expect(state).toMatchObject({
      totalXp: 40,
      streak: 1,
      stamina: 90,
      totalWorkouts: 1,
      totalDistance: 5,
    });
    const doc = await storedProfile(userId);
    expect(doc).toMatchObject({
      lastActivityDay: "2026-03-10",
      streak: 1,
      stamina: 90,
    });
  });

  it("adds a streak day when the last activity was yesterday in Manila", async () => {
    const userId = await player({ streak: 3, lastActivityDay: "2026-03-09" });
    expect((await record(userId)).player.streak).toBe(4);
  });

  it("keeps the streak on the same day", async () => {
    const userId = await player({ streak: 3, lastActivityDay: "2026-03-10" });
    expect((await record(userId)).player.streak).toBe(3);
  });

  it("resets the streak after a gap", async () => {
    const userId = await player({ streak: 3, lastActivityDay: "2026-03-05" });
    expect((await record(userId)).player.streak).toBe(1);
  });

  it("recovers stamina before applying the cost, floored at 0", async () => {
    const recovering = await player({
      stamina: 50,
      lastStaminaUpdate: new Date(NOW.getTime() - DAY_MS),
    });
    const exhausted = await player({ stamina: 5, lastStaminaUpdate: NOW });

    const recovered = await record(recovering, { staminaCost: 10 });
    const floored = await record(exhausted, { staminaCost: 30 });

    expect(recovered.player.stamina).toBeGreaterThan(40);
    expect(floored.player.stamina).toBe(0);
  });

  it("increments totals and writes a ledger row per call", async () => {
    const userId = await player({ totalWorkouts: 2, totalDistance: 10 });

    await record(userId, { totals: { workouts: 1, distanceKm: 3 } });
    await record(userId, { totals: { workouts: 1 } });

    expect(await storedProfile(userId)).toMatchObject({
      totalWorkouts: 4,
      totalDistance: 13,
      totalXp: 80,
    });
    const rows = await (await getCollection<XpLedgerDoc>("xpLedger"))
      .find({ userId })
      .toArray();
    expect(rows).toHaveLength(2);
  });

  it("emits a level-up event when the activity crosses a level", async () => {
    const userId = await player({ totalXp: 480 });
    await (await getCollection("outbox")).deleteMany({});

    const { leveledUp } = await record(userId, { xp: 40 });

    expect(leveledUp).toBe(true);
    expect(
      await (
        await getCollection("outbox")
      ).countDocuments({ type: "progression.leveled-up" }),
    ).toBe(1);
  });
});
