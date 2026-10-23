import { describe, it, expect, vi, beforeEach } from "vitest";
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
