import { describe, it, expect, beforeAll, afterEach } from "vitest";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { logRun } from "../runs/log-run";
import { getCollection, type UserDoc } from "@/server/platform/database";
import { IdempotencyKeyReusedError } from "@/server/platform/http";

const runInput = { distance: 5, duration: 30, difficulty: "moderate" as const };
const request = (fingerprint = "f1") => ({ key: crypto.randomUUID(), fingerprint });

describe("logRun Integration Test", () => {
  let userId: string;

  async function readUser() {
    const usersCol = await getCollection<UserDoc>("user");
    return (await usersCol.findOne({ _id: new ObjectId(userId) }))!;
  }

  beforeAll(async () => {
    const usersCol = await getCollection<UserDoc>("user");
    const { insertedId } = await usersCol.insertOne({
      email: "runner@example.com", name: "Runner", level: 1, xp: 0, xpToNextLevel: 500, streak: 0,
      totalWorkouts: 0, totalDistance: 0, stamina: 100, lastStaminaUpdate: new Date(), createdAt: new Date(),
    });
    userId = insertedId.toString();
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
