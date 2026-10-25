import { describe, it, expect, afterEach } from "vitest";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { logRun, updateRun, deleteRun } from "../run.service";
import { claimQuest } from "@/server/quests";
import {
  getCollection,
  type PlayerProfileDoc,
  type UserQuestDoc,
} from "@/server/platform/database";
import { levelFromTotalXp } from "@/server/progression";
import { deletePlayer, seedPlayer } from "@/testing/players";

const input = (distance: number, duration = 30) => ({ distance, duration, difficulty: "moderate" as const });
const request = () => ({ key: crypto.randomUUID(), fingerprint: "f1" });

describe("run edit and delete reconciliation", () => {
  let userId: string;
  let otherUserId: string | undefined;

  afterEach(async () => {
    for (const owner of [userId, otherUserId].filter((id): id is string => Boolean(id))) {
      await (await getCollection("runs")).deleteMany({ userId: owner });
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
  const quest = async (questTemplateId: string) =>
    (await getCollection<UserQuestDoc>("userQuests")).findOne({ userId, questTemplateId });

  async function seedRun(owner: string, date: Date, distance = 5, xpEarned = 100) {
    const { insertedId } = await (await getCollection("runs")).insertOne({
      userId: owner,
      distance,
      duration: 30,
      pace: 6,
      difficulty: "moderate",
      xpEarned,
      date,
    });
    return insertedId.toString();
  }

  async function seedLedgerRow(sourceType: string, sourceId: string, amount: number, occurredAt: Date) {
    await (await getCollection("xpLedger")).insertOne({
      userId,
      sourceType,
      sourceId,
      amount,
      occurredAt,
      createdAt: occurredAt,
    } as never);
  }

  it("edit applies the distance delta and recounts distance quests", async () => {
    userId = await seedPlayer({ profile: {} });
    const { value: run } = await logRun(input(1), userId, request());

    const updated = await updateRun(run.id, input(2.5), userId);

    expect((await profile()).totalDistance).toBe(2.5);
    expect(await quest("daily_run_2km")).toMatchObject({ completed: true });
    const rows = await ledger();
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(updated!.xpEarned);
  });

  it("edit up past a new highest level levels up once", async () => {
    userId = await seedPlayer({ profile: {} });
    const { value: run } = await logRun(input(1, 10), userId, request());
    const before = await profile();
    const eventsBefore = (await outbox("progression.leveled-up")).length;

    await updateRun(run.id, input(40, 400), userId);

    const after = await profile();
    expect(after.highestLevel).toBeGreaterThan(before.highestLevel);
    expect(await outbox("progression.leveled-up")).toHaveLength(eventsBefore + 1);
    expect(after.totalXp).toBe(await ledgerSum());
  });

  it("delete claws back a claimed daily quest", async () => {
    userId = await seedPlayer({ profile: {} });
    const { value: run } = await logRun(input(3), userId, request());
    const daily = await quest("daily_run_2km");
    await claimQuest(userId, daily!._id.toString());
    expect((await quest("daily_run_2km"))?.claimed).toBe(true);

    expect(await deleteRun(userId, run.id)).toBe(true);

    expect(await quest("daily_run_2km")).toMatchObject({ completed: false, claimed: false });
    const after = await profile();
    expect(after.totalXp).toBe(0);
    expect(after.totalDistance).toBe(0);
    const reverted = await outbox("activity.reverted");
    expect(reverted).toHaveLength(1);
    expect(reverted[0].payload).toEqual({ userId, activity: { type: "run", id: run.id } });
  });

  it("distance quests use the raw sum", async () => {
    userId = await seedPlayer({ profile: {} });
    await logRun(input(10), userId, request());
    await logRun(input(4.96), userId, request());
    const { value: short } = await logRun(input(1), userId, request());

    expect(await deleteRun(userId, short.id)).toBe(true);

    const weekly = await quest("weekly_run_15km");
    expect(weekly?.progress).toBeCloseTo(14.96, 10);
    expect(weekly?.completed).toBe(false);
  });

  it("delete in a past week claws back the claimed weekly quest and drops the level", async () => {
    userId = await seedPlayer({
      timeZone: "UTC",
      profile: { totalXp: 900, totalDistance: 16, totalWorkouts: 0 },
    });
    const runIds = [
      await seedRun(userId, new Date("2026-03-03T10:00:00Z"), 10),
      await seedRun(userId, new Date("2026-03-04T10:00:00Z"), 5),
      await seedRun(userId, new Date("2026-03-05T10:00:00Z"), 1),
    ];
    for (const id of runIds) await seedLedgerRow("run", id, 100, new Date("2026-03-04T10:00:00Z"));
    const quests = await getCollection<UserQuestDoc>("userQuests");
    const { insertedId: questId } = await quests.insertOne({
      userId,
      questTemplateId: "weekly_run_15km",
      target: 15,
      progress: 15,
      completed: true,
      claimed: true,
      periodStart: "2026-03-02",
      periodEnd: "2026-03-08",
    });
    await seedLedgerRow("quest_claim", questId.toString(), 600, new Date());
    expect(levelFromTotalXp((await profile()).totalXp).level).toBe(2);

    expect(await deleteRun(userId, runIds[1])).toBe(true);

    expect(await quests.findOne({ _id: questId })).toMatchObject({ progress: 11, completed: false, claimed: false });
    expect((await ledger()).some((row) => row.sourceType === "quest_claim")).toBe(false);
    const after = await profile();
    expect(after.totalXp).toBe(await ledgerSum());
    expect(after.totalXp).toBe(200);
    expect(levelFromTotalXp(after.totalXp).level).toBe(1);
  });

  it("edit and delete succeed for a run with no ledger row", async () => {
    userId = await seedPlayer({ profile: { totalDistance: 10, totalXp: 0 } });
    const toEdit = await seedRun(userId, new Date(), 5, 0);
    const toDelete = await seedRun(userId, new Date(), 5, 0);

    expect(await updateRun(toEdit, input(6), userId)).not.toBeNull();
    expect(await deleteRun(userId, toDelete)).toBe(true);

    expect((await profile()).totalXp).toBe(await ledgerSum());
  });

  it("another user's run and an unknown id are not found and nothing changes", async () => {
    userId = await seedPlayer({ profile: { totalXp: 40, totalDistance: 3 } });
    otherUserId = await seedPlayer({ profile: {} });
    const foreignId = await seedRun(otherUserId, new Date());
    await seedLedgerRow("run", "unrelated", 40, new Date());
    const before = await profile();
    const ledgerBefore = await ledger();

    for (const id of [foreignId, new ObjectId().toHexString()]) {
      expect(await deleteRun(userId, id)).toBe(false);
      expect(await updateRun(id, input(2), userId)).toBeNull();
    }

    expect(await profile()).toEqual(before);
    expect(await ledger()).toEqual(ledgerBefore);
    expect(await (await getCollection("runs")).countDocuments({ _id: new ObjectId(foreignId) })).toBe(1);
  });
});
