import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { getDashboardStats } from '../users/get-dashboard-stats';
import { getCollection } from "@/server/platform/database";

describe('getDashboardStats Integration Test', () => {
  const userId = 'dashboard-stats-user';
  const user = { totalXp: 0, timeZone: 'America/New_York' };

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
});
