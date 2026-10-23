import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCollection } from "@/server/platform/database";
import { POST } from "../route";
import { DELETE } from "../[id]/route";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn().mockResolvedValue("template-route-user"),
}));

const limit = vi.hoisted(() => vi.fn());

vi.mock("@/server/platform/http/rate-limiter", () => ({ createRateLimiter: () => limit }));

const validBody = {
  name: "Push Day",
  exercises: [{ name: "Bench Press", targetMuscle: "Chest", sets: 3, reps: 5, weight: 100 }],
};

function post(body: unknown, key?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Idempotency-Key"] = key;
  return POST(new Request("http://localhost:3000/api/workout-templates", { method: "POST", headers, body: JSON.stringify(body) }));
}

describe("POST /api/workout-templates - Idempotency-Key", () => {
  beforeEach(() => {
    limit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
  });

  afterEach(async () => {
    await (await getCollection("workoutTemplates")).deleteMany({ userId: "template-route-user" });
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
    const response = await post({ ...validBody, name: "Pull Day" }, key);

    expect(response.status).toBe(422);
  });
});

describe("DELETE /api/workout-templates/[id]", () => {
  it("returns 404 for a malformed template id", async () => {
    const response = await DELETE(
      new Request("http://localhost:3000/api/workout-templates/abc", { method: "DELETE" }),
      { params: Promise.resolve({ id: "abc" }) }
    );

    expect(response.status).toBe(404);
  });
});
