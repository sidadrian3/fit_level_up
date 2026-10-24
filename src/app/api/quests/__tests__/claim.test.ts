import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import { POST } from "../[id]/claim/route";
import { getCollection, type UserDoc } from "@/server/platform/database";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn(),
}));

const userId = "claim-route-user";

function claim(id: string) {
  return POST(
    new Request(`http://localhost:3000/api/quests/${id}/claim`, {
      method: "POST",
    }),
    {
      params: Promise.resolve({ id }),
    },
  );
}

describe("POST /api/quests/[id]/claim", () => {
  beforeAll(() => {
    vi.mocked(getAuthUserId).mockResolvedValue(userId);
  });

  afterEach(async () => {
    await (await getCollection("userQuests")).deleteMany({ userId });
    await (await getCollection("questTemplates")).deleteMany({});
  });

  it("returns 404 for a malformed quest id", async () => {
    expect((await claim("abc")).status).toBe(404);
  });

  it("returns 400 when the quest is not completed", async () => {
    const templates = await getCollection("questTemplates");
    const { insertedId } = await templates.insertOne({
      title: "Daily Burn",
      description: "d",
      category: "special",
      metric: "workout_count",
      target: 1,
      xpReward: 100,
      icon: "dumbbell",
      isActive: true,
    });
    const userQuests = await getCollection("userQuests");
    const quest = await userQuests.insertOne({
      userId,
      questTemplateId: insertedId.toString(),
      progress: 0,
      target: 1,
      completed: false,
      claimed: false,
      periodStart: "all-time",
      periodEnd: "all-time",
    });

    const response = await claim(quest.insertedId.toString());

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Quest is not completed");
  });

  it("grants the quest XP once and rejects a second claim with 409", async () => {
    const users = await getCollection<UserDoc>("user");
    const { insertedId: realUserId } = await users.insertOne({
      email: `claim-${crypto.randomUUID()}@example.com`,
      name: "Claimer",
      level: 1,
      xp: 450,
      xpToNextLevel: 500,
      streak: 0,
      totalWorkouts: 0,
      totalDistance: 0,
      stamina: 100,
      lastStaminaUpdate: new Date(),
      createdAt: new Date(),
    });
    const claimerId = realUserId.toString();
    vi.mocked(getAuthUserId).mockResolvedValue(claimerId);

    try {
      const { insertedId: templateId } = await (
        await getCollection("questTemplates")
      ).insertOne({
        title: "Big Reward",
        description: "d",
        category: "special",
        metric: "workout_count",
        target: 1,
        xpReward: 100,
        icon: "dumbbell",
        isActive: true,
      });
      const quest = await (
        await getCollection("userQuests")
      ).insertOne({
        userId: claimerId,
        questTemplateId: templateId.toString(),
        progress: 1,
        target: 1,
        completed: true,
        claimed: false,
        periodStart: "all-time",
        periodEnd: "all-time",
      });
      const questId = quest.insertedId.toString();

      expect((await claim(questId)).status).toBe(200);

      const user = await users.findOne({ _id: realUserId });
      expect(user).toMatchObject({ level: 2, xp: 50 });
      expect((await claim(questId)).status).toBe(409);
    } finally {
      await (
        await getCollection("userQuests")
      ).deleteMany({ userId: claimerId });
      await (await getCollection("outbox")).deleteMany({});
      await users.deleteOne({ _id: new ObjectId(claimerId) });
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
    }
  });
});
