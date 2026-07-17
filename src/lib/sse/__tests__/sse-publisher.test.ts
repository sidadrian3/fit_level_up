import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SSEEvent } from "../sse-types";

// ─── Mock @upstash/redis ────────────────────────────────────────────────
// We mock the entire module so no real Redis connection is needed.
const mockRpush = vi.fn().mockResolvedValue(1);
const mockExpire = vi.fn().mockResolvedValue(1);
const mockLpop = vi.fn().mockResolvedValue(null);

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      rpush: mockRpush,
      expire: mockExpire,
      lpop: mockLpop,
    }),
  },
}));

// Import AFTER mock is set up
import { publishToUser, publishToMany, consumeNextEvent } from "../sse-publisher";

describe("sse-publisher Unit Tests", () => {
  const userId = "user-abc-123";
  const event: SSEEvent = {
    type: "friend_request",
    payload: {
      actorId: "actor-1",
      actorName: "Alice",
      timestamp: "2026-07-15T12:00:00Z",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── publishToUser ──────────────────────────────────────────────────

  it("should RPUSH the serialized event to the correct Redis key", async () => {
    await publishToUser(userId, event);

    expect(mockRpush).toHaveBeenCalledWith(
      `sse:${userId}`,
      JSON.stringify(event)
    );
  });

  it("should set a 60-second EXPIRE on the queue after pushing", async () => {
    await publishToUser(userId, event);

    expect(mockExpire).toHaveBeenCalledWith(`sse:${userId}`, 60);
  });

  it("should NOT throw if Redis rpush fails (fire-and-forget)", async () => {
    mockRpush.mockRejectedValueOnce(new Error("Redis connection refused"));

    // Should not throw — just log the error
    await expect(publishToUser(userId, event)).resolves.not.toThrow();
  });

  // ─── publishToMany ─────────────────────────────────────────────────

  it("should call rpush once per userId in the array", async () => {
    const userIds = ["user-1", "user-2", "user-3"];
    await publishToMany(userIds, event);

    expect(mockRpush).toHaveBeenCalledTimes(3);
    expect(mockRpush).toHaveBeenCalledWith("sse:user-1", JSON.stringify(event));
    expect(mockRpush).toHaveBeenCalledWith("sse:user-2", JSON.stringify(event));
    expect(mockRpush).toHaveBeenCalledWith("sse:user-3", JSON.stringify(event));
  });

  it("should not throw if one userId fails (Promise.allSettled)", async () => {
    mockRpush
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("Redis down"))
      .mockResolvedValueOnce(1);

    await expect(
      publishToMany(["user-1", "user-2", "user-3"], event)
    ).resolves.not.toThrow();
  });

  // ─── consumeNextEvent ──────────────────────────────────────────────

  it("should LPOP from the correct Redis key and return parsed event", async () => {
    mockLpop.mockResolvedValueOnce(JSON.stringify(event));

    const result = await consumeNextEvent(userId);

    expect(mockLpop).toHaveBeenCalledWith(`sse:${userId}`);
    expect(result).toEqual(event);
  });

  it("should return null when the queue is empty", async () => {
    mockLpop.mockResolvedValueOnce(null);

    const result = await consumeNextEvent(userId);

    expect(result).toBeNull();
  });

  it("should handle Upstash returning an already-parsed object", async () => {
    // Upstash REST SDK sometimes auto-parses JSON strings
    mockLpop.mockResolvedValueOnce(event);

    const result = await consumeNextEvent(userId);

    expect(result).toEqual(event);
  });

  it("should return null and not throw if Redis lpop fails", async () => {
    mockLpop.mockRejectedValueOnce(new Error("Redis timeout"));

    const result = await consumeNextEvent(userId);

    expect(result).toBeNull();
  });
});
