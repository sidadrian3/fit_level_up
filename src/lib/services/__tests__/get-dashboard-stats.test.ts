import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { getDashboardStats } from '../users/get-dashboard-stats';
import { getCollection } from "@/server/platform/database";
import type { User } from '../../types';

describe('getDashboardStats Integration Test', () => {
  const userId = 'dashboard-stats-user';
  const user = { level: 1, xp: 0, timeZone: 'America/New_York' } as User;

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
    await workouts.insertMany([
      { userId, title: "Sunday", date: new Date("2026-10-19T03:00:00Z") },
      { userId, title: "Monday", date: new Date("2026-10-20T03:00:00Z") },
      { userId, title: "Last Monday", date: new Date("2026-10-12T05:00:00Z") },
    ]);
    const runs = await getCollection("runs");
    await runs.insertMany([
      { userId, distance: 5, date: new Date("2026-10-20T12:00:00Z") },
      { userId, distance: 3, date: new Date("2026-10-19T03:00:00Z") },
    ]);

    const stats = await getDashboardStats(userId, user);

    expect(stats.weeklyWorkouts).toBe(1);
    expect(stats.lastWeekWorkouts).toBe(2);
    expect(stats.weeklyDistance).toBe(5);
  });
});
