import { describe, it, expect, afterEach } from "vitest";
import { getActiveDaysThisWeek } from "../stats.service";
import { getCollection } from "@/server/platform/database";

describe("getActiveDaysThisWeek Integration Test", () => {
  const userId = "active-days-user";
  const timeZone = "America/New_York";
  const now = new Date("2026-10-22T02:00:00Z");

  afterEach(async () => {
    await (await getCollection("workouts")).deleteMany({ userId: { $in: [userId, "active-days-other"] } });
  });

  it("marks the user's local weekdays that have a workout, Monday first", async () => {
    const workouts = await getCollection("workouts");
    const base = { exercises: [], duration: 30, xpEarned: 100, title: "w" };
    await workouts.insertMany([
      { ...base, userId, date: new Date("2026-10-20T03:00:00Z") },
      { ...base, userId, date: new Date("2026-10-21T15:00:00Z") },
      { ...base, userId, date: new Date("2026-10-19T03:00:00Z") },
      { ...base, userId, date: new Date("2026-10-12T05:00:00Z") },
      { ...base, userId: "active-days-other", date: new Date("2026-10-22T00:00:00Z") },
    ]);

    expect(await getActiveDaysThisWeek(userId, { timeZone, now })).toEqual([
      true, false, true, false, false, false, false,
    ]);
  });

  it("is all false when the week has no workouts", async () => {
    expect(await getActiveDaysThisWeek(userId, { timeZone, now })).toEqual(Array(7).fill(false));
  });
});
