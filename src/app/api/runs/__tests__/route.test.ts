import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route"; // The Runs API handler
import { RateLimit } from "@/lib/auth/rate-limit"; 

// 1. Mock the auth helper
vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn().mockResolvedValue("fake-user-123")
}));

// 2. Mock the rate limiter
vi.mock("@/lib/auth/rate-limit", () => ({
  RateLimit: {
    limit: vi.fn()
  }
}));

describe("POST /api/runs - Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 429 Too Many Requests if rate limit is exceeded", async () => {
    // 1. Simulate the limit being hit
    vi.mocked(RateLimit.limit).mockResolvedValue({ success: false } as any);

    // 2. Create a fake request to the RUNS endpoint
    const request = new Request("http://localhost:3000/api/runs", {
      method: "POST",
      body: JSON.stringify({})
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
    // 1. Simulate the request being allowed
    vi.mocked(RateLimit.limit).mockResolvedValue({ success: true } as any);

    // 2. Create a fake request to the RUNS endpoint
    const request = new Request("http://localhost:3000/api/runs", {
      method: "POST",
      body: JSON.stringify({}) 
    });

    const response = await POST(request);
    
    // 3. Getting a 400 (Zod validation error for empty body) means it passed the 429 check
    expect(response.status).toBe(400); 
    expect(RateLimit.limit).toHaveBeenCalledWith("fake-user-123");
  });
});
