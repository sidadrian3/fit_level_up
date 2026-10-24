import { describe, it, expect, afterEach, vi } from "vitest";
import { recountQuestProgress, type QuestMeasure } from "../recount-quest-progress";
import { getCollection, type PlayerProfileDoc, type UserQuestDoc } from "@/server/platform/database";
import { deletePlayer, seedPlayer } from "@/testing/players";
import { inTransaction } from "@/testing/transactions";
import type { QuestMetric } from "@/lib/types";

const occurredAt = new Date("2026-03-10T08:00:00Z");

describe("recountQuestProgress", () => {
  let userId: string;

  afterEach(async () => {
    await (await getCollection("userQuests")).deleteMany({ userId });
    await (await getCollection("xpLedger")).deleteMany({ userId });
    await deletePlayer(userId);
    await (await getCollection("outbox")).deleteMany({});
  });

  const seedQuest = async (row: Partial<UserQuestDoc> & Pick<UserQuestDoc, "questTemplateId" | "target">) => {
    const { insertedId } = await (await getCollection<UserQuestDoc>("userQuests")).insertOne({
      userId,
      progress: 0,
      completed: false,
      claimed: false,
      periodStart: null,
      periodEnd: null,
      ...row,
    });
    return insertedId;
  };

  const seedLedger = async (sourceType: "workout" | "quest_claim", sourceId: string, amount: number) => {
    const now = new Date();
    await (await getCollection("xpLedger")).insertOne({
      userId,
      sourceType,
      sourceId,
      amount,
      occurredAt: now,
      createdAt: now,
    } as never);
  };

  const recount = (metrics: QuestMetric[], measure: QuestMeasure, at = occurredAt) =>
    inTransaction((session) =>
      recountQuestProgress(userId, { metrics, occurredAt: at, timeZone: "UTC", measure }, session),
    );

  const storedQuest = async (id: unknown) =>
    (await getCollection<UserQuestDoc>("userQuests")).findOne({ _id: id as never });

  const weekly = { periodStart: "2026-03-09", periodEnd: "2026-03-15" } as const;

  it("lowers progress and un-completes an unclaimed quest", async () => {
    userId = await seedPlayer({ profile: {} });
    const id = await seedQuest({ questTemplateId: "weekly_workouts_3", target: 3, progress: 3, completed: true, ...weekly });

    await recount(["workout_count"], async () => 2);

    expect(await storedQuest(id)).toMatchObject({ progress: 2, completed: false, claimed: false });
  });

  it("claws back a claimed quest in a past week", async () => {
    userId = await seedPlayer({ profile: { totalXp: 600 } });
    const id = await seedQuest({
      questTemplateId: "weekly_workouts_3",
      target: 3,
      progress: 3,
      completed: true,
      claimed: true,
      ...weekly,
    });
    await seedLedger("quest_claim", id.toString(), 500);
    await seedLedger("workout", "w1", 100);

    await recount(["workout_count"], async () => 2);

    expect(await storedQuest(id)).toMatchObject({ progress: 2, completed: false, claimed: false });
    const ledger = await (await getCollection("xpLedger")).find({ userId }).toArray();
    expect(ledger.map((row) => row.sourceType)).toEqual(["workout"]);
    const profile = await (await getCollection<PlayerProfileDoc>("playerProfiles")).findOne({ _id: userId });
    expect(profile?.totalXp).toBe(100);
  });

  it("caps progress at the target and completes", async () => {
    userId = await seedPlayer({ profile: {} });
    const id = await seedQuest({
      questTemplateId: "daily_run_2km",
      target: 2,
      periodStart: "2026-03-10",
      periodEnd: "2026-03-10",
    });

    await recount(["run_distance"], async () => 3.4);

    expect(await storedQuest(id)).toMatchObject({ progress: 2, completed: true });
  });

  it("passes the period range and null for all-time quests", async () => {
    userId = await seedPlayer({ profile: {} });
    await seedQuest({ questTemplateId: "weekend_run_1", target: 1 });
    const runMeasure = vi.fn<QuestMeasure>(async () => 0);
    await recount(["run_count"], runMeasure);
    expect(runMeasure).toHaveBeenCalledWith("run_count", null);

    await seedQuest({ questTemplateId: "daily_workout_1", target: 1, periodStart: "2026-03-10", periodEnd: "2026-03-10" });
    await seedQuest({ questTemplateId: "weekly_workouts_3", target: 3, ...weekly });
    const workoutMeasure = vi.fn<QuestMeasure>(async () => 0);
    await recount(["workout_count"], workoutMeasure);
    expect(workoutMeasure).toHaveBeenCalledWith("workout_count", {
      from: new Date("2026-03-10T00:00:00Z"),
      toExclusive: new Date("2026-03-11T00:00:00Z"),
    });
    expect(workoutMeasure).toHaveBeenCalledWith("workout_count", {
      from: new Date("2026-03-09T00:00:00Z"),
      toExclusive: new Date("2026-03-16T00:00:00Z"),
    });
  });

  it("skips periods without a row", async () => {
    userId = await seedPlayer({ profile: {} });
    const measure = vi.fn<QuestMeasure>(async () => 1);

    await recount(["workout_count", "run_distance"], measure);

    expect(measure).not.toHaveBeenCalled();
    expect(await (await getCollection("userQuests")).countDocuments({ userId })).toBe(0);
  });
});
