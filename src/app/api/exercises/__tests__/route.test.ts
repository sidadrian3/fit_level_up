import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../route";
import { getCollection } from "@/server/platform/database";

const userId = "exercise-route-user";

vi.mock("@/server/platform/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/platform/auth")>()),
  requireSessionUserId: vi.fn().mockResolvedValue("exercise-route-user"),
}));

const limit = vi.hoisted(() => vi.fn());

vi.mock("@/server/platform/http/rate-limiter", () => ({ createRateLimiter: () => limit }));

function post(body: unknown) {
  return POST(new Request("http://localhost:3000/api/exercises", { method: "POST", body: JSON.stringify(body) }));
}

describe("POST /api/exercises", () => {
  beforeEach(() => {
    limit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
  });

  afterEach(async () => {
    await (await getCollection("customExercises")).deleteMany({ userId });
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    limit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

    const response = await post({ name: "Foo", targetMuscle: "Chest" });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).not.toBeNull();
    expect(limit).toHaveBeenCalledWith("standard", `exercises.create:${userId}`);
  });

  it("returns 400 for a non-string name", async () => {
    expect((await post({ name: 123, targetMuscle: "Chest" })).status).toBe(400);
  });

  it("returns 400 for an unknown target muscle", async () => {
    expect((await post({ name: "Foo", targetMuscle: "Banana" })).status).toBe(400);
  });

  it("returns 400 for a blank name", async () => {
    expect((await post({ name: "   ", targetMuscle: "Chest" })).status).toBe(400);
  });

  it("creates the exercise and returns 201", async () => {
    const response = await post({ name: "  cable fly ", targetMuscle: "Chest" });

    expect(response.status).toBe(201);
    expect((await response.json()).name).toBe("Cable Fly");
  });

  it("returns 409 when the same exercise already exists", async () => {
    await post({ name: "Cable Fly", targetMuscle: "Chest" });

    expect((await post({ name: "cable   fly", targetMuscle: "Chest" })).status).toBe(409);
  });
});
