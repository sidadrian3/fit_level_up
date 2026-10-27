import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { getCollection } from "@/server/platform/database";
import { seedPlayer, deletePlayer } from "@/testing/players";
import { requireSessionUserId } from "@/server/platform/auth";
import type { Quest } from "@/shared/contracts/quest";

vi.mock("@/server/platform/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/platform/auth")>()),
  requireSessionUserId: vi.fn(),
}));

const EXPECTED_KEYS = ["category", "claimed", "completed", "description", "icon", "id", "progress", "target", "title", "xpReward"];

describe("GET /api/quests", () => {
  let userId: string;

  beforeEach(async () => {
    userId = await seedPlayer({ email: `quests-list-${crypto.randomUUID()}@example.com`, name: "Quester", timeZone: "UTC" });
    vi.mocked(requireSessionUserId).mockResolvedValue(userId);
  });

  afterEach(async () => {
    await (await getCollection("userQuests")).deleteMany({ userId });
    await deletePlayer(userId);
  });

  async function listQuests(): Promise<Quest[]> {
    const response = await GET(new Request("http://localhost:3000/api/quests"));
    expect(response.status).toBe(200);
    return response.json();
  }

  it("creates the period's rows for every seeded definition and returns the Quest shape", async () => {
    const quests = await listQuests();

    expect(quests).toHaveLength(5);
    for (const quest of quests) {
      expect(Object.keys(quest).sort()).toEqual(EXPECTED_KEYS);
      expect(typeof quest.id).toBe("string");
      expect(quest.id.length).toBeGreaterThan(0);
      expect(quest).toMatchObject({ progress: 0, completed: false, claimed: false });
    }
    expect(quests.map(({ title, category, xpReward, target }) => ({ title, category, xpReward, target })).sort((a, b) => a.title.localeCompare(b.title))).toEqual([
      { title: "Daily Burn", category: "daily", xpReward: 100, target: 1 },
      { title: "Daily Steps", category: "daily", xpReward: 100, target: 2 },
      { title: "Marathon Prep", category: "weekly", xpReward: 600, target: 15 },
      { title: "Weekend Warrior", category: "special", xpReward: 300, target: 1 },
      { title: "Weekly Consistency", category: "weekly", xpReward: 500, target: 3 },
    ]);
    expect(await (await getCollection("userQuests")).countDocuments({ userId })).toBe(5);
  });

  it("returns the all-time special quest", async () => {
    const quests = await listQuests();

    const special = quests.find((quest) => quest.category === "special");
    expect(special).toMatchObject({ title: "Weekend Warrior", xpReward: 300, icon: "flame" });
  });

  it("does not create duplicate rows when listed twice", async () => {
    await listQuests();
    const quests = await listQuests();

    expect(quests).toHaveLength(5);
    expect(await (await getCollection("userQuests")).countDocuments({ userId })).toBe(5);
  });

  it("excludes a row from a past period", async () => {
    await (await getCollection("userQuests")).insertOne({
      userId,
      questTemplateId: "daily_workout_1",
      progress: 1,
      target: 1,
      completed: true,
      claimed: true,
      periodStart: "2000-01-03",
      periodEnd: "2000-01-03",
    });

    const quests = await listQuests();

    expect(quests).toHaveLength(5);
    expect(quests.some((quest) => quest.completed || quest.claimed)).toBe(false);
  });
});
