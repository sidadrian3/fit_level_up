import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getCollection, type UserDoc } from "@/server/platform/database";
import { POST } from "../route";

const limit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn().mockResolvedValue("fake-user-123"),
}));

vi.mock("@/server/platform/http/rate-limiter", () => ({ createRateLimiter: () => limit }));

const postEmpty = () =>
  POST(new Request("http://localhost:3000/api/workouts", { method: "POST", body: JSON.stringify({}) }));

describe("POST /api/workouts - Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 with Retry-After if the rate limit is exceeded", async () => {
    limit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

    const response = await postEmpty();

    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("Too many requests");
    expect(response.headers.get("Retry-After")).not.toBeNull();
    expect(limit).toHaveBeenCalledWith("standard", "workouts.create:fake-user-123");
  });

  it("proceeds past the rate limiter if the limit is not exceeded", async () => {
    limit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });

    const response = await postEmpty();

    // A 400 from Zod validation means the request passed the limiter.
    expect(response.status).toBe(400);
    expect(limit).toHaveBeenCalledWith("standard", "workouts.create:fake-user-123");
  });
});

const validBody = {
  title: "Morning Lift",
  duration: 30,
  exercises: [{ name: "Squats", targetMuscle: "Legs", sets: 3, reps: 10, weight: 100 }],
};

function post(body: unknown, key?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Idempotency-Key"] = key;
  return POST(new Request("http://localhost:3000/api/workouts", { method: "POST", headers, body: JSON.stringify(body) }));
}

describe("POST /api/workouts - Idempotency-Key", () => {
  let userId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    limit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    const usersCol = await getCollection<UserDoc>("user");
    const { insertedId } = await usersCol.insertOne({
      email: `wk-${crypto.randomUUID()}@example.com`, name: "Route User", level: 1, xp: 0, xpToNextLevel: 500, streak: 0,
      totalWorkouts: 0, totalDistance: 0, stamina: 100, lastStaminaUpdate: new Date(), createdAt: new Date(),
    });
    userId = insertedId.toString();
    vi.mocked(getAuthUserId).mockResolvedValue(userId);
  });

  afterEach(async () => {
    await (await getCollection("workouts")).deleteMany({ userId });
    await (await getCollection<UserDoc>("user")).deleteOne({ _id: new ObjectId(userId) });
  });

  it("returns 400 without an Idempotency-Key header", async () => {
    const response = await post(validBody);

    expect(response.status).toBe(400);
  });

  it("replays a retry with Idempotent-Replayed", async () => {
    const key = crypto.randomUUID();

    const first = await post(validBody, key);
    const retry = await post(validBody, key);

    expect(first.status).toBe(201);
    expect(first.headers.get("Idempotent-Replayed")).toBeNull();
    expect(retry.status).toBe(201);
    expect(retry.headers.get("Idempotent-Replayed")).toBe("true");
    expect((await retry.json()).id).toBe((await first.json()).id);
  });

  it("returns 422 when the key is reused with a different body", async () => {
    const key = crypto.randomUUID();

    await post(validBody, key);
    const response = await post({ ...validBody, title: "Different Lift" }, key);

    expect(response.status).toBe(422);
  });
});
