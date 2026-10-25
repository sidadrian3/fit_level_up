import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { logRun } from "../run.service";
import { getCollection, type PlayerProfileDoc } from "@/server/platform/database";
import { getPlayerState } from "@/server/progression";
import { seedPlayer, deletePlayer } from "@/testing/players";
import { IdempotencyKeyReusedError } from "@/server/platform/http";

const runInput = { distance: 5, duration: 30, difficulty: "moderate" as const };
const request = (fingerprint = "f1") => ({ key: crypto.randomUUID(), fingerprint });

describe("logRun Integration Test", () => {
  let userId: string;

  async function readUser() {
    const profile = (await (await getCollection<PlayerProfileDoc>("playerProfiles")).findOne({ _id: userId }))!;
    return { totalDistance: profile.totalDistance, xp: (await getPlayerState(userId)).xp };
  }

  beforeAll(async () => {
    userId = await seedPlayer({ email: "runner@example.com", name: "Runner", profile: {} });
  });

  afterAll(async () => {
    await deletePlayer(userId);
  });

  beforeEach(async () => {
    await (await getCollection("outbox")).deleteMany({});
  });

  afterEach(async () => {
    await (await getCollection("runs")).deleteMany({ userId });
  });

  it("logs a run and increments the user's total distance", async () => {
    const before = await readUser();

    const { value, replayed } = await logRun(runInput, userId, request());

    expect(replayed).toBe(false);
    expect(value.distance).toBe(5);
    expect((await readUser()).totalDistance).toBe(before.totalDistance + 5);
  });

  it("emits activity.logged with the run", async () => {
    const { value: run } = await logRun(runInput, userId, request());

    const rows = await (await getCollection("outbox")).find({ type: "activity.logged" }).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toMatchObject({ userId, activity: { type: "run", id: run.id } });
    expect(rows[0].payload.occurredAt).toBeInstanceOf(Date);
  });

  it("a replay emits nothing more", async () => {
    const req = request();

    await logRun(runInput, userId, req);
    await logRun(runInput, userId, req);

    expect(await (await getCollection("outbox")).countDocuments({ type: "activity.logged" })).toBe(1);
  });

  it("stores the fingerprint on the run", async () => {
    const req = request("fingerprint-abc");

    await logRun(runInput, userId, req);

    const doc = await (await getCollection("runs")).findOne({ userId, idempotencyKey: req.key });
    expect(doc!.idempotencyFingerprint).toBe("fingerprint-abc");
  });

  it("replays a duplicate request without counting the distance twice", async () => {
    const req = request();
    const first = await logRun(runInput, userId, req);
    const afterFirst = await readUser();

    const second = await logRun(runInput, userId, req);

    expect(second.replayed).toBe(true);
    expect(second.value.id).toBe(first.value.id);
    const afterSecond = await readUser();
    expect(afterSecond.totalDistance).toBe(afterFirst.totalDistance);
    expect(afterSecond.xp).toBe(afterFirst.xp);
    expect(await (await getCollection("runs")).countDocuments({ userId, idempotencyKey: req.key })).toBe(1);
  });

  it("rejects the same key with a different fingerprint with 422", async () => {
    const key = crypto.randomUUID();
    await logRun(runInput, userId, { key, fingerprint: "f1" });
    const before = await readUser();

    const retry = logRun(runInput, userId, { key, fingerprint: "f2" });

    await expect(retry).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
    await expect(retry).rejects.toThrow(
      "This run was already saved with your earlier details. Check your history to edit it, or submit again to log a new one."
    );
    expect((await readUser()).totalDistance).toBe(before.totalDistance);
  });
});
