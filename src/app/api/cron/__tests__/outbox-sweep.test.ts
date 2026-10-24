import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { publishToMany } from "@/lib/sse/sse-publisher";
import { buildFriendshipPairKey } from "@/lib/domain/friend-rules";
import type { AchievementDefinitionDoc } from "@/lib/data/achievements-db";
import { getCollection, type FriendshipDoc } from "@/server/platform/database";
import { calcLifetimeXp } from "@/server/progression";
import { seedPlayer, deletePlayer } from "@/testing/players";
import { POST } from "@/app/api/workouts/route";
import { GET } from "../outbox-sweep/route";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: () => {},
}));

vi.mock("@/lib/auth/auth-helpers", () => ({ getAuthUserId: vi.fn() }));

vi.mock("@/server/platform/http/rate-limiter", () => ({
  createRateLimiter: () => async () => ({ success: true, reset: Date.now() + 60_000 }),
}));

vi.mock("@/lib/sse/sse-publisher", () => ({
  publishToMany: vi.fn(async () => {}),
  publishToUser: vi.fn(async () => {}),
}));

const achievementId = "outbox_sweep_first_workout";

const sweep = (authorization?: string) =>
  GET(new Request("http://localhost:3000/api/cron/outbox-sweep", {
    headers: authorization ? { authorization } : {},
  }));

describe("GET /api/cron/outbox-sweep", () => {
  let userId: string;
  let friendId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    await (await getCollection("outbox")).deleteMany({});
    userId = await seedPlayer({ name: "Lifter", profile: { totalXp: calcLifetimeXp(1, 499) } });
    friendId = await seedPlayer({ name: "Friend", profile: {} });
    vi.mocked(getAuthUserId).mockResolvedValue(userId);

    const now = new Date();
    await (await getCollection<FriendshipDoc>("friendships")).insertOne({
      requesterId: userId, receiverId: friendId, pairKey: buildFriendshipPairKey(userId, friendId),
      status: "accepted", createdAt: now, updatedAt: now,
    });
    await (await getCollection<AchievementDefinitionDoc>("achievements")).insertOne({
      id: achievementId, title: "First Lift", description: "Log a workout", icon: "star", rarity: "common",
      condition: { metric: "total_workouts", target: 1 },
    });
  });

  afterEach(async () => {
    await (await getCollection("outbox")).deleteMany({});
    await (await getCollection("workouts")).deleteMany({ userId });
    await (await getCollection("userAchievements")).deleteMany({ userId });
    await (await getCollection("achievements")).deleteOne({ id: achievementId });
    await (await getCollection("friendships")).deleteMany({ requesterId: userId });
    await deletePlayer(userId);
    await deletePlayer(friendId);
  });

  it("returns 401 without a bearer token", async () => {
    expect((await sweep()).status).toBe(401);
  });

  it("returns 401 with the wrong token", async () => {
    expect((await sweep("Bearer wrong-token")).status).toBe(401);
  });

  it("delivers events from a killed dispatch exactly once", async () => {
    const created = await POST(new Request("http://localhost:3000/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        title: "Morning Lift", duration: 30,
        exercises: [{ name: "Squats", targetMuscle: "Legs", sets: 3, reps: 10, weight: 100 }],
      }),
    }));
    expect(created.status).toBe(201);
    const outbox = await getCollection("outbox");
    const pending = await outbox.find({ status: "pending" }).toArray();
    expect(pending.map(row => row.type).sort()).toEqual(["activity.logged", "progression.leveled-up"]);

    const first = await sweep(`Bearer ${process.env.CRON_SECRET}`);

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ delivered: 2, failed: 0, dead: 0 });
    const unlocks = await (await getCollection("userAchievements")).countDocuments({ userId, achievementId });
    expect(unlocks).toBe(1);
    expect(publishToMany).toHaveBeenCalledTimes(1);
    expect(publishToMany).toHaveBeenCalledWith(
      [friendId],
      expect.objectContaining({ type: "friend_level_up", payload: expect.objectContaining({ newLevel: 2 }) })
    );

    const second = await sweep(`Bearer ${process.env.CRON_SECRET}`);

    expect(await second.json()).toEqual({ delivered: 0, failed: 0, dead: 0 });
    expect(publishToMany).toHaveBeenCalledTimes(1);
    expect(await (await getCollection("userAchievements")).countDocuments({ userId, achievementId })).toBe(1);
  });
});
