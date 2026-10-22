import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { evaluateAchievements } from "../achievements/evaluate-achievements";
import { getCollection, type UserDoc } from "@/server/platform/database";
import type { AchievementDefinitionDoc } from "@/lib/data/achievements-db";

const achievementId = "evaluate_test_level_one";

describe("evaluateAchievements Integration Test", () => {
  let userId: string;

  beforeAll(async () => {
    const usersCol = await getCollection<UserDoc>("user");
    const { insertedId } = await usersCol.insertOne({
      email: "evaluate@example.com", name: "Evaluate", level: 1, xp: 0, xpToNextLevel: 500, streak: 0,
      totalWorkouts: 0, totalDistance: 0, stamina: 100, lastStaminaUpdate: new Date(), createdAt: new Date(),
    });
    userId = insertedId.toString();

    const definitions = await getCollection<AchievementDefinitionDoc>("achievements");
    await definitions.insertOne({
      id: achievementId, title: "Level One", description: "Be level 1", icon: "star", rarity: "common",
      condition: { metric: "level", target: 1 },
    });
  });

  afterEach(async () => {
    await (await getCollection("userAchievements")).deleteMany({ userId });
  });

  it("unlocks a met achievement and reports it", async () => {
    const unlocked = await evaluateAchievements(userId);

    expect(unlocked.map(a => a.id)).toContain(achievementId);
  });

  it("unlocks once and reports it once when two evaluations race", async () => {
    const [first, second] = await Promise.all([evaluateAchievements(userId), evaluateAchievements(userId)]);

    const reports = [...first, ...second].filter(a => a.id === achievementId);
    expect(reports).toHaveLength(1);
    const unlocks = await (await getCollection("userAchievements")).countDocuments({ userId, achievementId });
    expect(unlocks).toBe(1);
  });
});
