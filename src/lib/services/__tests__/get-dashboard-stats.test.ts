import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { getDashboardStats } from '../users/get-dashboard-stats';
import { calcLifetimeXp } from "@/server/progression";
import { getCollection } from "@/server/platform/database";

describe('getDashboardStats Integration Test', () => {
  const userId = 'dashboard-stats-user';
  const user = { level: 1, xp: 0, timeZone: 'America/New_York' };

  beforeAll(async () => {
  });

  afterEach(async () => {
    vi.useRealTimers();
    await (await getCollection("workouts")).deleteMany({ userId });
    await (await getCollection("runs")).deleteMany({ userId });
  });

  it("splits weeks on the user's local Monday boundary", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T02:00:00Z"));

    const workouts = await getCollection("workouts");
    const workoutBase = { userId, exercises: [], duration: 30, xpEarned: 100 };
    await workouts.insertMany([
      { ...workoutBase, title: "Sunday", date: new Date("2026-10-19T03:00:00Z") },
      { ...workoutBase, title: "Monday", date: new Date("2026-10-20T03:00:00Z") },
      { ...workoutBase, title: "Last Monday", date: new Date("2026-10-12T05:00:00Z") },
    ]);
    const runs = await getCollection("runs");
    const runBase = { userId, duration: 30, pace: 6, xpEarned: 50, difficulty: "easy" };
    await runs.insertMany([
      { ...runBase, distance: 5, date: new Date("2026-10-20T12:00:00Z") },
      { ...runBase, distance: 3, date: new Date("2026-10-19T03:00:00Z") },
    ]);

    const stats = await getDashboardStats(userId, user);

    expect(stats.weeklyWorkouts).toBe(1);
    expect(stats.lastWeekWorkouts).toBe(2);
    expect(stats.weeklyDistance).toBe(5);
  });

  it("counts a Manila Sunday-night workout in the user's local week, not the UTC week", async () => {
    const manila = { level: 1, xp: 0, timeZone: 'Asia/Manila' };
    const now = new Date("2026-10-21T00:00:00Z");
    const workouts = await getCollection("workouts");
    const workoutBase = { userId, exercises: [], duration: 30, xpEarned: 100 };
    await workouts.insertMany([
      { ...workoutBase, title: "Manila Sunday 23:30", date: new Date("2026-10-18T15:30:00Z") },
      { ...workoutBase, title: "Manila Monday 00:30", date: new Date("2026-10-18T16:30:00Z") },
      { ...workoutBase, title: "Next Manila Sunday 23:30", date: new Date("2026-10-25T15:30:00Z") },
      { ...workoutBase, title: "Next Manila Monday 00:30", date: new Date("2026-10-25T16:30:00Z") },
    ]);

    const stats = await getDashboardStats(userId, manila, now);

    expect(stats.lastWeekWorkouts).toBe(1);
    expect(stats.weeklyWorkouts).toBe(2);
  });

  it("derives lifetimeXP from level and xp and counts only the user's achievements", async () => {
    const unlocks = await getCollection("userAchievements");
    await unlocks.insertMany([
      { userId, achievementId: "first_workout", unlockedDate: "2026-10-20" },
      { userId, achievementId: "speed_demon", unlockedDate: "2026-10-21" },
      { userId: "dashboard-stats-other-user", achievementId: "first_workout", unlockedDate: "2026-10-21" },
    ]);

    try {
      const stats = await getDashboardStats(userId, { ...user, level: 3, xp: 40 });

      expect(stats.totalAchievements).toBe(2);
      expect(stats.lifetimeXP).toBe(calcLifetimeXp(3, 40));
      expect(stats.lifetimeXP).toBeGreaterThan(40);
    } finally {
      await unlocks.deleteMany({ userId: { $in: [userId, "dashboard-stats-other-user"] } });
    }
  });
});
