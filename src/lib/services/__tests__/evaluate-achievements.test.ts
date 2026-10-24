import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { evaluateAchievements } from "../achievements/evaluate-achievements";
import { getCollection } from "@/server/platform/database";
import { seedPlayer, deletePlayer } from "@/testing/players";

const achievementId = "first_workout";

describe("evaluateAchievements Integration Test", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await seedPlayer({ email: "evaluate@example.com", name: "Evaluate", profile: { totalWorkouts: 1 } });
  });

  afterAll(async () => {
    await deletePlayer(userId);
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
