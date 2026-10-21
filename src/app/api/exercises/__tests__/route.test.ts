import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../route";
import { RateLimit } from "@/lib/auth/rate-limit";
import { getCollection } from "@/lib/data/get-collection";

const userId = "exercise-route-user";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn().mockResolvedValue("exercise-route-user"),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  RateLimit: { limit: vi.fn() },
}));

function post(body: unknown) {
  return POST(new Request("http://localhost:3000/api/exercises", { method: "POST", body: JSON.stringify(body) }));
}

describe("POST /api/exercises", () => {
  beforeEach(() => {
    vi.mocked(RateLimit.limit).mockResolvedValue({ success: true } as never);
  });

  afterEach(async () => {
    await (await getCollection("customExercisesCollection")).deleteMany({ userId });
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    vi.mocked(RateLimit.limit).mockResolvedValue({ success: false } as never);

    expect((await post({ name: "Foo", targetMuscle: "Chest" })).status).toBe(429);
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
