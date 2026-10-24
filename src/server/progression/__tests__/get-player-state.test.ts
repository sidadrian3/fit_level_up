import { describe, it, expect, afterEach } from "vitest";
import { getPlayerState } from "../get-player-state";
import { getCollection } from "@/server/platform/database";
import { deletePlayer, seedPlayer } from "@/testing/players";

describe("getPlayerState", () => {
  const created: string[] = [];
  afterEach(async () => {
    await Promise.all(created.splice(0).map(deletePlayer));
  });

  it("returns defaults for a missing profile and writes nothing", async () => {
    const userId = await seedPlayer({ timeZone: "Asia/Manila" });
    created.push(userId);

    const state = await getPlayerState(userId);

    expect(state).toMatchObject({
      level: 1,
      xp: 0,
      xpToNextLevel: 500,
      totalXp: 0,
      streak: 0,
      stamina: 100,
      totalWorkouts: 0,
      totalDistance: 0,
    });
    expect(
      await (
        await getCollection("playerProfiles")
      ).countDocuments({ _id: userId as never }),
    ).toBe(0);
  });

  it("shows streak 0 after a gap", async () => {
    const userId = await seedPlayer({
      timeZone: "Asia/Manila",
      profile: { streak: 5, lastActivityDay: "2026-03-01" },
    });
    created.push(userId);

    const state = await getPlayerState(userId, {
      now: new Date("2026-03-10T04:00:00Z"),
    });

    expect(state.streak).toBe(0);
  });

  it("keeps the streak when the last activity was yesterday", async () => {
    const userId = await seedPlayer({
      timeZone: "Asia/Manila",
      profile: { streak: 5, lastActivityDay: "2026-03-09" },
    });
    created.push(userId);

    const state = await getPlayerState(userId, {
      now: new Date("2026-03-10T04:00:00Z"),
    });

    expect(state.streak).toBe(5);
  });

  it("recovers stamina up to now", async () => {
    const userId = await seedPlayer({
      profile: {
        stamina: 20,
        lastStaminaUpdate: new Date("2026-03-01T00:00:00Z"),
      },
    });
    created.push(userId);

    const state = await getPlayerState(userId, {
      now: new Date("2026-03-03T00:00:00Z"),
    });

    expect(state.stamina).toBeGreaterThan(20);
  });
});
