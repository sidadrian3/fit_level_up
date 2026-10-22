import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { sweepLockedAchievements } from "../achievements/sweep-locked-achievements";
import { getCollection, type UserDoc } from "@/server/platform/database";
import { AchievementDefinitionDoc } from "../../data/achievements-db";

describe("sweepLockedAchievements", () => {
  beforeAll(async () => {
    const usersCol = await getCollection<UserDoc>("user");
    await usersCol.deleteMany({});

    await usersCol.insertOne({
      email: "sixty-hours@example.com",
      name: "Sixty Hours User",
      level: 1,
      xp: 0,
      xpToNextLevel: 500,
      streak: 0,
      totalWorkouts: 0,
      totalDistance: 0,
      stamina: 100,
      lastActivityDate: new Date(Date.now() - 60 * 3_600_000),
      lastStaminaUpdate: new Date(),
      createdAt: new Date(),
    });

    // Setup a dummy active user
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
    const inactiveDate = new Date(Date.now() - 4 * 24 * 3_600_000);
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
      "achievements",
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

  afterAll(async () => {
    const usersCol = await getCollection<UserDoc>("user");
    await usersCol.deleteMany({});
  });

  afterEach(async () => {
    const userAchievementsCol = await getCollection(
      "userAchievements",
    );
    await userAchievementsCol.deleteMany({});
  });

  it("should sweep active users and safely evaluate them without throwing", async () => {
    const result = await sweepLockedAchievements();

    // Users active now and 60 hours ago are processed; the one inactive for 4 days is not
    expect(result.processed).toBe(2);
    expect(result.errors).toBe(0);
  });
});
