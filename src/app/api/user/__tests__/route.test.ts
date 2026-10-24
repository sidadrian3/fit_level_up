import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getCollection, type UserDoc } from "@/server/platform/database";
import { GAME_CONFIG } from "@/server/platform/config";
import { GET } from "../route";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn(),
}));

vi.mock("@/server/platform/http/rate-limiter", () => ({ createRateLimiter: () => vi.fn() }));

const NOW = new Date("2026-10-20T10:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("GET /api/user", () => {
  let userId: string;

  async function seedUser(overrides: Partial<UserDoc> = {}) {
    const users = await getCollection<UserDoc>("user");
    const { insertedId } = await users.insertOne({
      email: `user-route-${crypto.randomUUID()}@example.com`,
      name: "Route User",
      level: 3,
      xp: 200,
      xpToNextLevel: 1500,
      streak: 4,
      stamina: 40,
      totalWorkouts: 12,
      totalDistance: 7.5,
      timeZone: "Asia/Manila",
      lastActivityDate: new Date("2026-10-19T00:00:00Z"),
      lastStaminaUpdate: NOW,
      createdAt: new Date("2026-01-05T12:00:00Z"),
      ...overrides,
    });
    userId = insertedId.toString();
    vi.mocked(getAuthUserId).mockResolvedValue(userId);
  }

  async function getBody() {
    const response = await GET(new Request("http://localhost:3000/api/user"));
    expect(response.status).toBe(200);
    return (await response.json()) as Record<string, unknown>;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await (await getCollection<UserDoc>("user")).deleteOne({ _id: new ObjectId(userId) });
  });

  it("returns the exact user shape with formatted dates", async () => {
    await seedUser();

    const body = await getBody();

    expect(Object.keys(body).sort()).toEqual(
      [
        "id", "email", "name", "avatar", "level", "xp", "xpToNextLevel", "streak", "totalWorkouts",
        "totalDistance", "joinDate", "lastActivityDate", "stamina", "lastStaminaUpdate", "timeZone", "__v",
      ].sort()
    );
    expect(body).toMatchObject({
      id: userId,
      level: 3,
      xp: 200,
      xpToNextLevel: 1500,
      totalWorkouts: 12,
      totalDistance: 7.5,
      timeZone: "Asia/Manila",
      joinDate: "2026-01-05",
      lastActivityDate: "2026-10-19",
      lastStaminaUpdate: NOW.toISOString(),
    });
  });

  it("keeps the streak when the last activity was yesterday in the user's time zone", async () => {
    await seedUser({ lastActivityDate: new Date("2026-10-19T00:00:00Z") });

    expect((await getBody()).streak).toBe(4);
  });

  it("displays a zero streak when the last activity was two days ago", async () => {
    await seedUser({ lastActivityDate: new Date("2026-10-18T00:00:00Z") });

    expect((await getBody()).streak).toBe(0);
  });

  it("recovers stamina for the days since the last update", async () => {
    await seedUser({ stamina: 40, lastStaminaUpdate: new Date(NOW.getTime() - 2 * DAY_MS) });

    expect((await getBody()).stamina).toBe(Math.min(100, 40 + 2 * GAME_CONFIG.stamina.dailyRecovery));
  });

  it("falls back to defaults for a user document with no game fields", async () => {
    const users = await getCollection("user");
    const { insertedId } = await users.insertOne({ email: `bare-${crypto.randomUUID()}@example.com`, name: "Bare" });
    userId = insertedId.toString();
    vi.mocked(getAuthUserId).mockResolvedValue(userId);

    expect(await getBody()).toMatchObject({
      level: 1,
      xp: 0,
      xpToNextLevel: 500,
      streak: 0,
      stamina: 100,
      totalWorkouts: 0,
      totalDistance: 0,
    });
  });
});
