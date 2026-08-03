import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { sweepLockedAchievements } from "../achievements/sweep-locked-achievements";
import { getCollection } from "../../data/get-collection";
import { UserMongoDoc } from "../../data/user-db";
import { AchievementDefinitionDoc } from "../../data/achievements-db";

describe("sweepLockedAchievements", () => {
  beforeAll(async () => {
    // Setup a dummy active user
    const usersCol = await getCollection<UserMongoDoc>("usersCollection");
    await usersCol.insertOne({
      email: "active@example.com",
      name: "Active User",
      level: 1,
      xp: 0,
      xpToNextLevel: 500,
      streak: 0,
      totalWorkouts: 0,
      totalDistance: 0,
      stamina: 100,
      lastActivityDate: new Date(),
      lastStaminaUpdate: new Date(),
      createdAt: new Date(),
    });

    // Setup a dummy inactive user
    const inactiveDate = new Date();
    inactiveDate.setDate(inactiveDate.getDate() - 3);
    await usersCol.insertOne({
      email: "inactive@example.com",
      name: "Inactive User",
      level: 1,
      xp: 0,
      xpToNextLevel: 500,
      streak: 0,
      totalWorkouts: 0,
      totalDistance: 0,
      stamina: 100,
      lastActivityDate: inactiveDate,
      lastStaminaUpdate: new Date(),
      createdAt: new Date(),
    });

    // Setup an achievement template
    const achievementsCol = await getCollection<AchievementDefinitionDoc>(
      "achievementsCollection",
    );
    await achievementsCol.insertOne({
      id: "first_workout",
      title: "First Workout",
      description: "Log your first workout",
      condition: { metric: "total_workouts", target: 1 },
      icon: "star",
      rarity: "common",
    });
  });

  afterEach(async () => {
    const userAchievementsCol = await getCollection(
      "userAchievementsCollection",
    );
    await userAchievementsCol.deleteMany({});
  });

  it("should sweep active users and safely evaluate them without throwing", async () => {
    const result = await sweepLockedAchievements();

    // There is exactly 1 active user
    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);
  });
});
