import { describe, it, expect, afterEach } from "vitest";
import crypto from "crypto";
import { logRun } from "../log-run";
import { updateRun } from "../update-run";
import { deleteRun } from "../delete-run";
import { claimQuest } from "@/server/quests";
import {
  getCollection,
  type PlayerProfileDoc,
  type UserQuestDoc,
} from "@/server/platform/database";
import { deletePlayer, seedPlayer } from "@/testing/players";

const input = (distance: number, duration = 30) => ({ distance, duration, difficulty: "moderate" as const });
const request = () => ({ key: crypto.randomUUID(), fingerprint: "f1" });

describe("run edit and delete reconciliation", () => {
  let userId: string;

  afterEach(async () => {
    await (await getCollection("runs")).deleteMany({ userId });
    await (await getCollection("userQuests")).deleteMany({ userId });
    await deletePlayer(userId);
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
});
