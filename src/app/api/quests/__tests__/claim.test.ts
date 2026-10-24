import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { POST } from "../[id]/claim/route";
import { getCollection } from "@/server/platform/database";
import { calcLifetimeXp, getPlayerState } from "@/server/progression";
import { seedPlayer, deletePlayer } from "@/testing/players";
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
  });

  it("returns 404 for a malformed quest id", async () => {
    expect((await claim("abc")).status).toBe(404);
  });

  it("returns 400 when the quest is not completed", async () => {
    const userQuests = await getCollection("userQuests");
    const quest = await userQuests.insertOne({
      userId,
      questTemplateId: "daily_workout_1",
      progress: 0,
      target: 1,
      completed: false,
      claimed: false,
      periodStart: null,
      periodEnd: null,
    });

    const response = await claim(quest.insertedId.toString());

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Quest is not completed");
  });

  it("grants the quest XP once and rejects a second claim with 409", async () => {
    const claimerId = await seedPlayer({
      email: `claim-${crypto.randomUUID()}@example.com`,
      name: "Claimer",
      profile: { totalXp: calcLifetimeXp(1, 450) },
    });
    vi.mocked(getAuthUserId).mockResolvedValue(claimerId);

    try {
      const quest = await (
        await getCollection("userQuests")
      ).insertOne({
        userId: claimerId,
        questTemplateId: "daily_workout_1",
        progress: 1,
        target: 1,
        completed: true,
        claimed: false,
        periodStart: null,
        periodEnd: null,
      });
      const questId = quest.insertedId.toString();

      expect((await claim(questId)).status).toBe(200);

      expect(await getPlayerState(claimerId)).toMatchObject({ level: 2, xp: 50 });
      expect((await claim(questId)).status).toBe(409);
    } finally {
      await (
        await getCollection("userQuests")
      ).deleteMany({ userId: claimerId });
      await (await getCollection("outbox")).deleteMany({});
      await deletePlayer(claimerId);
      vi.mocked(getAuthUserId).mockResolvedValue(userId);
    }
  });
});
