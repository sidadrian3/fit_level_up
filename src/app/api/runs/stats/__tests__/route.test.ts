import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { getCollection } from "@/server/platform/database";
import { requireSessionUserId } from "@/server/platform/auth";

vi.mock("@/server/platform/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/platform/auth")>()),
  requireSessionUserId: vi.fn(),
}));

const userId = "run-stats-route-user";

describe("GET /api/runs/stats", () => {
  beforeEach(() => {
    vi.mocked(requireSessionUserId).mockResolvedValue(userId);
  });

  afterEach(async () => {
    await (await getCollection("runs")).deleteMany({ userId });
  });

  async function getStats() {
    const response = await GET(new Request("http://localhost:3000/api/runs/stats"));
    expect(response.status).toBe(200);
    return response.json();
  }

  it("returns zeros for a user with no runs", async () => {
    expect(await getStats()).toEqual({ totalKm: 0, totalRuns: 0, avgPace: 0 });
  });

  it("rounds total distance to 1 decimal and average pace to 2 decimals", async () => {
    const base = { userId, difficulty: "moderate" as const, xpEarned: 50, date: new Date() };
    await (await getCollection("runs")).insertMany([
      { ...base, distance: 5.04, duration: 30, pace: 6.123 },
      { ...base, distance: 3.02, duration: 20, pace: 6.5 },
      { ...base, distance: 1.01, duration: 7, pace: 7.0 },
    ]);

    expect(await getStats()).toEqual({ totalKm: 9.1, totalRuns: 3, avgPace: 6.54 });
  });

  it("ignores another user's runs", async () => {
    await (await getCollection("runs")).insertOne({
      userId: "run-stats-other-user", distance: 10, duration: 50, pace: 5, difficulty: "easy", xpEarned: 1, date: new Date(),
    });

    try {
      expect(await getStats()).toEqual({ totalKm: 0, totalRuns: 0, avgPace: 0 });
    } finally {
      await (await getCollection("runs")).deleteMany({ userId: "run-stats-other-user" });
    }
  });
});
