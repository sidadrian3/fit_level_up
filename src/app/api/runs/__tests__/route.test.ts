import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getCollection } from "@/server/platform/database";
import { seedPlayer, deletePlayer } from "@/testing/players";
import { POST } from "../route";

const limit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn().mockResolvedValue("fake-user-123"),
}));

vi.mock("@/server/platform/http/rate-limiter", () => ({ createRateLimiter: () => limit }));

const postEmpty = () =>
  POST(new Request("http://localhost:3000/api/runs", { method: "POST", body: JSON.stringify({}) }));

describe("POST /api/runs - Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 with Retry-After if the rate limit is exceeded", async () => {
    limit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 });

    const response = await postEmpty();

    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("Too many requests");
    expect(response.headers.get("Retry-After")).not.toBeNull();
    expect(limit).toHaveBeenCalledWith("standard", "runs.create:fake-user-123");
  });

  it("proceeds past the rate limiter if the limit is not exceeded", async () => {
    limit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });

    const response = await postEmpty();

    // A 400 from Zod validation means the request passed the limiter.
    expect(response.status).toBe(400);
    expect(limit).toHaveBeenCalledWith("standard", "runs.create:fake-user-123");
  });
});

const validBody = { distance: 5, duration: 30, difficulty: "moderate" };

function post(body: unknown, key?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Idempotency-Key"] = key;
  return POST(new Request("http://localhost:3000/api/runs", { method: "POST", headers, body: JSON.stringify(body) }));
}

describe("POST /api/runs - Idempotency-Key", () => {
  let userId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    limit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    userId = await seedPlayer({ email: `run-${crypto.randomUUID()}@example.com`, name: "Route User", profile: {} });
    vi.mocked(getAuthUserId).mockResolvedValue(userId);
  });

  afterEach(async () => {
    await (await getCollection("runs")).deleteMany({ userId });
    await deletePlayer(userId);
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
    const response = await post({ ...validBody, distance: 10 }, key);

    expect(response.status).toBe(422);
  });
});
