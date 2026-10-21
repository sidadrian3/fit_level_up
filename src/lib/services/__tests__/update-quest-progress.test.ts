import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { logWorkout } from "../workouts/log-workout";
import { getUserQuests } from "../quests/get-user-quests";
import { getCollection } from "@/lib/data/get-collection";
import { ensureIndexes } from "@/lib/data/ensure-indexes";
import type { UserMongoDoc } from "@/lib/data/user-db";
import { TargetMuscle } from "@/lib/types";

const workout = () => ({
  title: "Quest Test",
  duration: 10,
  exercises: [{ name: "Squat", targetMuscle: TargetMuscle.Legs, sets: 1, reps: 1, weight: null }],
  idempotencyKey: crypto.randomUUID(),
});

describe("quest progress through logWorkout", () => {
  let userId: string;

  beforeAll(async () => {
    await ensureIndexes();
    const usersCol = await getCollection<UserMongoDoc>("usersCollection");
    const { insertedId } = await usersCol.insertOne({
      email: "quests@example.com", name: "Quests", level: 1, xp: 0, xpToNextLevel: 500, streak: 0,
      totalWorkouts: 0, totalDistance: 0, stamina: 100, lastStaminaUpdate: new Date(), createdAt: new Date(),
    });
    userId = insertedId.toString();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await (await getCollection("userQuestsCollection")).deleteMany({ userId });
    await (await getCollection("questTemplatesCollection")).deleteMany({});
    await (await getCollection("workoutsCollection")).deleteMany({ userId });
  });

  async function seedWorkoutQuestTemplates() {
    const templates = await getCollection("questTemplatesCollection");
    await templates.insertMany([
      { title: "Daily Burn", description: "d", category: "daily", metric: "workout_count", target: 1, xpReward: 100, icon: "dumbbell", isActive: true },
      { title: "Weekly Consistency", description: "w", category: "weekly", metric: "workout_count", target: 3, xpReward: 500, icon: "calendar", isActive: true },
    ]);
  }

  it("credits daily and weekly progress even when the quests were never synced", async () => {
    await seedWorkoutQuestTemplates();
    const userQuests = await getCollection("userQuestsCollection");
    expect(await userQuests.countDocuments({ userId })).toBe(0);

    await logWorkout(workout(), userId);

    const rows = await userQuests.find({ userId }).toArray();
    expect(rows.map(r => r.progress).sort()).toEqual([1, 1]);
    expect(rows.find(r => r.target === 1)?.completed).toBe(true);
  });

  it("keeps crediting the same rows on later workouts, capped at the target", async () => {
    await seedWorkoutQuestTemplates();

    await logWorkout(workout(), userId);
    await logWorkout(workout(), userId);

    const rows = await (await getCollection("userQuestsCollection")).find({ userId }).toArray();
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.target === 1)?.progress).toBe(1);
    expect(rows.find(r => r.target === 3)?.progress).toBe(2);
  });

  it("does not duplicate rows when quests are listed repeatedly", async () => {
    await seedWorkoutQuestTemplates();

    await Promise.all([getUserQuests(userId), getUserQuests(userId)]);
    await logWorkout(workout(), userId);
    const quests = await getUserQuests(userId);

    expect(quests).toHaveLength(2);
    expect(await (await getCollection("userQuestsCollection")).countDocuments({ userId })).toBe(2);
  });

  it("credits the local-day period row", async () => {
    await seedWorkoutQuestTemplates();
    await (await getCollection<UserMongoDoc>("usersCollection")).updateOne(
      { _id: new ObjectId(userId) },
      { $set: { timeZone: "Asia/Manila" } },
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-20T23:00:00Z"));

    await logWorkout(workout(), userId);

    const dailyRow = await (await getCollection("userQuestsCollection")).findOne({ userId, target: 1 });
    expect(dailyRow?.periodStart).toBe("2026-10-21");
    expect(dailyRow?.progress).toBe(1);
    const quests = await getUserQuests(userId);
    expect(quests.find(q => q.target === 1)?.progress).toBe(1);
  });
});
