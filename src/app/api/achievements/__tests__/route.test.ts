import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { getCollection } from "@/server/platform/database";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import type { Achievement } from "@/shared/contracts/achievement";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn(),
}));

const userId = "achievements-route-user";

describe("GET /api/achievements", () => {
  beforeEach(() => {
    vi.mocked(getAuthUserId).mockResolvedValue(userId);
  });

  afterEach(async () => {
    await (await getCollection("userAchievements")).deleteMany({ userId });
  });

  async function listAchievements(): Promise<Achievement[]> {
    const response = await GET(new Request("http://localhost:3000/api/achievements"));
    expect(response.status).toBe(200);
    return response.json();
  }

  it("returns all five definitions locked for a user with no unlocks", async () => {
    const achievements = await listAchievements();

    expect(achievements.map((achievement) => achievement.id).sort()).toEqual(
      ["first_workout", "iron_will", "legendary_warrior", "speed_demon", "unstoppable"],
    );
    expect(achievements.every((achievement) => achievement.unlocked === false && achievement.unlockedDate === undefined)).toBe(true);
  });

  it("populates unlocked and unlockedDate only for the unlocked achievement", async () => {
    await (await getCollection("userAchievements")).insertOne({
      userId,
      achievementId: "first_workout",
      unlockedDate: "2026-10-20",
    });

    const achievements = await listAchievements();

    expect(achievements).toHaveLength(5);
    expect(achievements.find((achievement) => achievement.id === "first_workout")).toEqual({
      id: "first_workout",
      title: "First Steps",
      description: "Complete your first workout",
      icon: "footprints",
      rarity: "common",
      unlocked: true,
      unlockedDate: "2026-10-20",
    });
    expect(achievements.filter((achievement) => achievement.unlocked)).toHaveLength(1);
  });

  it("does not leak another user's unlocks", async () => {
    await (await getCollection("userAchievements")).insertOne({
      userId: "someone-else",
      achievementId: "iron_will",
      unlockedDate: "2026-10-20",
    });

    try {
      const achievements = await listAchievements();

      expect(achievements.some((achievement) => achievement.unlocked)).toBe(false);
    } finally {
      await (await getCollection("userAchievements")).deleteMany({ userId: "someone-else" });
    }
  });
});
