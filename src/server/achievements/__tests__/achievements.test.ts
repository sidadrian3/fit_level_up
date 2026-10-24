import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getCollection } from "@/server/platform/database";
import { seedPlayer, deletePlayer } from "@/testing/players";
import { isConditionMet } from "../achievement.rules";
import { countUnlockedAchievements, evaluateAchievements, listAchievements } from "../index";

const achievementId = "first_workout";

describe("isConditionMet", () => {
  const stats = { totalWorkouts: 10, totalDistance: 5, level: 3, streak: 7 };

  it.each([
    ["total_workouts", 10],
    ["total_distance", 5],
    ["level", 3],
    ["streak", 7],
  ] as const)("%s is met at its target", (metric, target) => {
    expect(isConditionMet({ metric, target }, stats)).toBe(true);
  });

  it.each([
    ["total_workouts", 11],
    ["total_distance", 5.1],
    ["level", 4],
    ["streak", 8],
  ] as const)("%s is not met below its target", (metric, target) => {
    expect(isConditionMet({ metric, target }, stats)).toBe(false);
  });
});

describe("achievements", () => {
  let userId: string;

  beforeEach(async () => {
    userId = await seedPlayer({ email: `evaluate-${Date.now()}@example.com`, name: "Evaluate", profile: { totalWorkouts: 1 } });
  });

  afterEach(async () => {
    await (await getCollection("userAchievements")).deleteMany({ userId });
    await (await getCollection("outbox")).deleteMany({ type: "achievement.unlocked", "payload.userId": userId });
    await deletePlayer(userId);
  });

  it("unlocks a met achievement and reports it", async () => {
    expect(await evaluateAchievements(userId)).toContain(achievementId);
  });

  it("unlocks once and reports it once when two evaluations race", async () => {
    const [first, second] = await Promise.all([evaluateAchievements(userId), evaluateAchievements(userId)]);

    expect([...first, ...second].filter((id) => id === achievementId)).toHaveLength(1);
    expect(await (await getCollection("userAchievements")).countDocuments({ userId, achievementId })).toBe(1);
  });

  it("emits achievement.unlocked once per new unlock, in the same transaction", async () => {
    expect(await evaluateAchievements(userId)).toEqual(["first_workout"]);

    const rows = await (await getCollection("outbox")).find({ type: "achievement.unlocked", "payload.userId": userId }).toArray();
    expect(rows.map((row) => row.payload)).toEqual([{ userId, achievementId: "first_workout" }]);
  });

  it("concurrent evaluations insert one unlock and emit one event", async () => {
    const [a, b] = await Promise.all([evaluateAchievements(userId), evaluateAchievements(userId)]);

    expect([...a, ...b]).toEqual(["first_workout"]);
    expect(await (await getCollection("outbox")).countDocuments({ type: "achievement.unlocked", "payload.userId": userId })).toBe(1);
  });

  it("returns nothing and emits nothing when everything met is already unlocked", async () => {
    await evaluateAchievements(userId);

    expect(await evaluateAchievements(userId)).toEqual([]);
    expect(await (await getCollection("outbox")).countDocuments({ type: "achievement.unlocked", "payload.userId": userId })).toBe(1);
  });

  it("countUnlockedAchievements and listAchievements reflect unlocks", async () => {
    const now = new Date("2026-10-20T10:00:00.000Z");
    await evaluateAchievements(userId, now);

    expect(await countUnlockedAchievements(userId)).toBe(1);
    const achievements = await listAchievements(userId);
    expect(achievements).toHaveLength(5);
    expect(achievements.filter((achievement) => achievement.unlocked).map((achievement) => achievement.id)).toEqual(["first_workout"]);
    expect(achievements.find((achievement) => achievement.id === "first_workout")?.unlockedDate).toBe(now.toISOString());
    expect(achievements.filter((achievement) => achievement.unlockedDate !== undefined)).toHaveLength(1);
  });
});
