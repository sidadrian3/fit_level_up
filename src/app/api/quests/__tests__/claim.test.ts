import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { POST } from "../[id]/claim/route";
import { getCollection } from "@/lib/data/get-collection";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn(),
}));

const userId = "claim-route-user";

function claim(id: string) {
  return POST(new Request(`http://localhost:3000/api/quests/${id}/claim`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("POST /api/quests/[id]/claim", () => {
  beforeAll(() => {
    vi.mocked(getAuthUserId).mockResolvedValue(userId);
  });

  afterEach(async () => {
    await (await getCollection("userQuestsCollection")).deleteMany({ userId });
    await (await getCollection("questTemplatesCollection")).deleteMany({});
  });

  it("returns 404 for a malformed quest id", async () => {
    expect((await claim("abc")).status).toBe(404);
  });

  it("returns 400 when the quest is not completed", async () => {
    const templates = await getCollection("questTemplatesCollection");
    const { insertedId } = await templates.insertOne({
      title: "Daily Burn", description: "d", category: "special", metric: "workout_count",
      target: 1, xpReward: 100, icon: "dumbbell", isActive: true,
    });
    const userQuests = await getCollection("userQuestsCollection");
    const quest = await userQuests.insertOne({
      userId, questTemplateId: insertedId.toString(), progress: 0, target: 1,
      completed: false, claimed: false, periodStart: "all-time", periodEnd: "all-time",
    });

    const response = await claim(quest.insertedId.toString());

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Quest is not completed");
  });
});
