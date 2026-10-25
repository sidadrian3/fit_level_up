import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { logWorkout } from "@/server/training";
import { getQuests } from "../quest.service";
import { getCollection, type UserDoc } from "@/server/platform/database";
import { seedPlayer, deletePlayer } from "@/testing/players";
import { TargetMuscle } from "@/lib/types";

const request = () => ({ key: crypto.randomUUID(), fingerprint: "f1" });

const workout = () => ({
  title: "Quest Test",
  duration: 10,
  exercises: [{ name: "Squat", targetMuscle: TargetMuscle.Legs, sets: 1, reps: 1, weight: null }],
});

describe("quest progress through logWorkout", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await seedPlayer({ email: "quests@example.com", name: "Quests", profile: {} });
  });

  afterAll(async () => {
    await deletePlayer(userId);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await (await getCollection("userQuests")).deleteMany({ userId });
    await (await getCollection("workouts")).deleteMany({ userId });
  });

  it("credits daily and weekly progress even when the quests were never synced", async () => {
    const userQuests = await getCollection("userQuests");
    expect(await userQuests.countDocuments({ userId })).toBe(0);

    await logWorkout(workout(), userId, request());

    const rows = await userQuests.find({ userId }).toArray();
    expect(rows.map(r => r.progress).sort()).toEqual([1, 1]);
    expect(rows.find(r => r.target === 1)?.completed).toBe(true);
  });

  it("keeps crediting the same rows on later workouts, capped at the target", async () => {

    await logWorkout(workout(), userId, request());
    await logWorkout(workout(), userId, request());

    const rows = await (await getCollection("userQuests")).find({ userId }).toArray();
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.target === 1)?.progress).toBe(1);
    expect(rows.find(r => r.target === 3)?.progress).toBe(2);
  });

  it("does not duplicate rows when quests are listed repeatedly", async () => {

    await Promise.all([getQuests(userId), getQuests(userId)]);
    await logWorkout(workout(), userId, request());
    const quests = await getQuests(userId);

    expect(quests).toHaveLength(5);
    expect(await (await getCollection("userQuests")).countDocuments({ userId })).toBe(5);
  });

  it("credits the local-day period row", async () => {
    await (await getCollection<UserDoc>("user")).updateOne(
      { _id: new ObjectId(userId) },
      { $set: { timeZone: "Asia/Manila" } },
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T23:00:00Z"));

    await logWorkout(workout(), userId, request());

    const dailyRow = await (await getCollection("userQuests")).findOne({ userId, target: 1 });
    expect(dailyRow?.periodStart).toBe("2026-10-21");
    expect(dailyRow?.progress).toBe(1);
    const quests = await getQuests(userId);
    expect(quests.find(q => q.target === 1)?.progress).toBe(1);
  });
});
