import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route"; // The API handler we are testing
import { RateLimit } from "@/lib/auth/rate-limit"; // The thing we are mocking

// 1. Mock the auth helper to return a fake user ID
vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn().mockResolvedValue("fake-user-123")
}));

// 2. Mock the rate limiter so we don't actually hit Redis!
vi.mock("@/lib/auth/rate-limit", () => ({
  RateLimit: {
    limit: vi.fn()
  }
}));

describe("POST /api/workouts - Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 429 Too Many Requests if rate limit is exceeded", async () => {
    // 1. Tell our mock to return success: false (simulating the limit being hit)
    vi.mocked(RateLimit.limit).mockResolvedValue({ success: false } as any);

    // 2. Create a fake request
    const request = new Request("http://localhost:3000/api/workouts", {
      method: "POST",
      body: JSON.stringify({}) // Body doesn't matter for this test
    });

    // 3. Call the API route handler directly
    const response = await POST(request);
    const json = await response.json();

    // 4. Assert it returns 429
    expect(response.status).toBe(429);
    expect(json.error).toBe("Too many requests");
    expect(RateLimit.limit).toHaveBeenCalledWith("fake-user-123");
  });

  it("should proceed past rate limiter if limit is not exceeded", async () => {
    // 1. Tell our mock to allow the request
    vi.mocked(RateLimit.limit).mockResolvedValue({ success: true } as any);

    const request = new Request("http://localhost:3000/api/workouts", {
      method: "POST",
      body: JSON.stringify({})
    });

    const response = await POST(request);
    
    // 2. Getting a 400 (Zod validation error) means it successfully passed the 429 rate limiter!
    expect(response.status).toBe(400); 
    expect(RateLimit.limit).toHaveBeenCalledWith("fake-user-123");
  });
});
