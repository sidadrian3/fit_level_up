import { describe, it, expect, afterEach } from "vitest";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { logWorkout, updateWorkout, deleteWorkout } from "../workout.service";
import {
  getCollection,
  type PlayerProfileDoc,
  type UserQuestDoc,
} from "@/server/platform/database";
import { deletePlayer, seedPlayer } from "@/testing/players";
import { levelFromTotalXp } from "@/server/progression";
import { TargetMuscle } from "@/lib/types";

const lift = { name: "Bench Press", targetMuscle: TargetMuscle.Chest, sets: 3, reps: 10, weight: 60 };
const input = (duration: number) => ({ title: "Push Day", duration, exercises: [lift] });
const request = () => ({ key: crypto.randomUUID(), fingerprint: "f1" });

describe("workout edit and delete reconciliation", () => {
  let userId: string;
  let otherUserId: string | undefined;

  afterEach(async () => {
    for (const owner of [userId, otherUserId].filter((id): id is string => Boolean(id))) {
      await (await getCollection("workouts")).deleteMany({ userId: owner });
      await (await getCollection("userQuests")).deleteMany({ userId: owner });
      await deletePlayer(owner);
    }
    otherUserId = undefined;
    await (await getCollection("outbox")).deleteMany({});
  });

  const profile = async () =>
    (await (await getCollection<PlayerProfileDoc>("playerProfiles")).findOne({ _id: userId }))!;
  const ledger = async () => (await getCollection("xpLedger")).find({ userId }).toArray();
  const ledgerSum = async () => (await ledger()).reduce((sum, row) => sum + row.amount, 0);
  const outbox = async (type: string) =>
    (await getCollection("outbox")).find({ type } as never).toArray();

  async function seedWorkout(owner: string, date: Date, xpEarned = 50) {
    const { insertedId } = await (await getCollection("workouts")).insertOne({
      userId: owner,
      title: "Seeded",
      exercises: [],
      duration: 10,
      xpEarned,
      date,
    });
    return insertedId.toString();
  }

  async function seedLedgerRow(id: string, amount: number, occurredAt: Date) {
    await (await getCollection("xpLedger")).insertOne({
      userId,
      sourceType: "workout",
      sourceId: id,
      amount,
      occurredAt,
      createdAt: occurredAt,
    } as never);
  }

  it("edit down replaces the ledger row and lowers the level", async () => {
    userId = await seedPlayer({ profile: {} });
    const { value: workout } = await logWorkout(input(300), userId, request());
    expect((await profile()).highestLevel).toBeGreaterThanOrEqual(2);
    const eventsBefore = (await outbox("progression.leveled-up")).length;

    const updated = await updateWorkout(workout.id, input(1), userId);

    const rows = await ledger();
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(updated!.xpEarned);
    const after = await profile();
    expect(after.totalXp).toBe(await ledgerSum());
    expect(after.totalXp).toBe(updated!.xpEarned);
    expect(await outbox("progression.leveled-up")).toHaveLength(eventsBefore);
  });

  it("re-earning a level after an edit down emits no second level-up", async () => {
    userId = await seedPlayer({ profile: {} });
    const { value: workout } = await logWorkout(input(300), userId, request());
    const earnedLevel = (await profile()).highestLevel;
    expect(earnedLevel).toBeGreaterThanOrEqual(2);
    expect(await outbox("progression.leveled-up")).toHaveLength(1);

    await updateWorkout(workout.id, input(1), userId);
    expect(levelFromTotalXp((await profile()).totalXp).level).toBeLessThan(earnedLevel);
    await updateWorkout(workout.id, input(300), userId);

    expect(levelFromTotalXp((await profile()).totalXp).level).toBe(earnedLevel);
    expect(await outbox("progression.leveled-up")).toHaveLength(1);
    expect((await profile()).highestLevel).toBe(earnedLevel);
  });

  it("re-earning a level after a delete emits no second level-up", async () => {
    userId = await seedPlayer({ profile: {} });
    const { value: workout } = await logWorkout(input(300), userId, request());
    const earnedLevel = (await profile()).highestLevel;
    expect(await outbox("progression.leveled-up")).toHaveLength(1);

    expect(await deleteWorkout(userId, workout.id)).toBe(true);
    expect(levelFromTotalXp((await profile()).totalXp).level).toBe(1);
    await (await getCollection<PlayerProfileDoc>("playerProfiles")).updateOne(
      { _id: userId },
      { $set: { stamina: 100, lastStaminaUpdate: new Date() } },
    );
    await logWorkout(input(300), userId, request());

    expect(levelFromTotalXp((await profile()).totalXp).level).toBe(earnedLevel);
    expect(await outbox("progression.leveled-up")).toHaveLength(1);
    expect((await profile()).highestLevel).toBe(earnedLevel);
  });

  it("edit and delete succeed for a workout with no ledger row", async () => {
    userId = await seedPlayer({ profile: { totalWorkouts: 2 } });
    const toEdit = await seedWorkout(userId, new Date());
    const toDelete = await seedWorkout(userId, new Date());

    expect(await updateWorkout(toEdit, input(60), userId)).not.toBeNull();
    expect(await deleteWorkout(userId, toDelete)).toBe(true);

    expect((await profile()).totalXp).toBe(await ledgerSum());
  });

  it("an unchanged edit leaves game state as it was", async () => {
    userId = await seedPlayer({ profile: {} });
    const { value: workout } = await logWorkout(input(60), userId, request());
    const before = await profile();
    const eventsBefore = await (await getCollection("outbox")).countDocuments();

    await updateWorkout(workout.id, input(60), userId);

    const after = await profile();
    expect(after.totalXp).toBe(before.totalXp);
    expect(after.highestLevel).toBe(before.highestLevel);
    expect(await (await getCollection("outbox")).countDocuments()).toBe(eventsBefore);
  });

  it("delete removes XP and the workout total and emits activity.reverted", async () => {
    userId = await seedPlayer({ profile: {} });
    const { value: workout } = await logWorkout(input(60), userId, request());

    expect(await deleteWorkout(userId, workout.id)).toBe(true);

    const after = await profile();
    expect(after.totalXp).toBe(0);
    expect(after.totalWorkouts).toBe(0);
    const reverted = await outbox("activity.reverted");
    expect(reverted).toHaveLength(1);
    expect(reverted[0].payload).toEqual({ userId, activity: { type: "workout", id: workout.id } });
    const daily = await (await getCollection<UserQuestDoc>("userQuests")).findOne({ userId, questTemplateId: "daily_workout_1" });
    expect(daily?.progress).toBe(0);
  });

  it("delete recounts the quest of the workout's own week", async () => {
    userId = await seedPlayer({ profile: { totalXp: 500, totalWorkouts: 3 } });
    const target = await seedWorkout(userId, new Date("2026-03-03T10:00:00Z"));
    await seedWorkout(userId, new Date("2026-03-04T10:00:00Z"));
    await seedWorkout(userId, new Date("2026-03-05T10:00:00Z"));
    const quests = await getCollection<UserQuestDoc>("userQuests");
    const { insertedId: pastId } = await quests.insertOne({
      userId,
      questTemplateId: "weekly_workouts_3",
      target: 3,
      progress: 3,
      completed: true,
      claimed: true,
      periodStart: "2026-03-02",
      periodEnd: "2026-03-08",
    });
    const { insertedId: currentId } = await quests.insertOne({
      userId,
      questTemplateId: "weekly_workouts_3",
      target: 3,
      progress: 1,
      completed: false,
      claimed: false,
      periodStart: "2099-01-05",
      periodEnd: "2099-01-11",
    });
    await (await getCollection("xpLedger")).insertOne({
      userId,
      sourceType: "quest_claim",
      sourceId: pastId.toString(),
      amount: 500,
      occurredAt: new Date(),
      createdAt: new Date(),
    } as never);

    expect(await deleteWorkout(userId, target)).toBe(true);

    expect(await quests.findOne({ _id: pastId })).toMatchObject({ progress: 2, completed: false, claimed: false });
    expect(await quests.findOne({ _id: currentId })).toMatchObject({ progress: 1, completed: false });
    expect((await ledger()).some((row) => row.sourceType === "quest_claim")).toBe(false);
    expect((await profile()).totalXp).toBe(await ledgerSum());
  });

  it("delete recounts the streak on the user's local day", async () => {
    userId = await seedPlayer({
      timeZone: "Asia/Manila",
      profile: { streak: 3, lastActivityDay: "2026-03-11", totalWorkouts: 3, totalXp: 30 },
    });
    const first = await seedWorkout(userId, new Date("2026-03-08T20:00:00Z"));
    const middle = await seedWorkout(userId, new Date("2026-03-09T20:00:00Z"));
    const last = await seedWorkout(userId, new Date("2026-03-10T20:00:00Z"));
    await seedLedgerRow(first, 10, new Date("2026-03-08T20:00:00Z"));
    await seedLedgerRow(middle, 10, new Date("2026-03-09T20:00:00Z"));
    await seedLedgerRow(last, 10, new Date("2026-03-10T20:00:00Z"));

    expect(await deleteWorkout(userId, middle)).toBe(true);

    expect(await profile()).toMatchObject({ streak: 1, lastActivityDay: "2026-03-11" });
  });

  it("concurrent deletes both land", async () => {
    userId = await seedPlayer({ profile: {} });
    const { value: first } = await logWorkout(input(60), userId, request());
    const { value: second } = await logWorkout(input(45), userId, request());

    const results = await Promise.all([deleteWorkout(userId, first.id), deleteWorkout(userId, second.id)]);

    expect(results).toEqual([true, true]);
    const after = await profile();
    expect(after.totalWorkouts).toBe(0);
    expect(after.totalXp).toBe(await ledgerSum());
    expect(after.totalXp).toBe(0);
  });

  it("another user's workout is not found and nothing changes", async () => {
    userId = await seedPlayer({ profile: { totalXp: 40, totalWorkouts: 1 } });
    otherUserId = await seedPlayer({ profile: {} });
    const id = await seedWorkout(otherUserId, new Date());
    const before = await profile();
    const ledgerBefore = await ledger();

    expect(await deleteWorkout(userId, id)).toBe(false);

    expect(await profile()).toEqual(before);
    expect(await ledger()).toEqual(ledgerBefore);
    expect(await (await getCollection("workouts")).countDocuments({ _id: new ObjectId(id) })).toBe(1);
  });
});
