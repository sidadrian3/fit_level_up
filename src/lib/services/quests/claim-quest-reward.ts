import { QUEST_ENTRY_BY_ID, syncUserQuests } from "@/lib/services/quests/sync-user-quests";
import { getUserTimeZone } from "@/server/platform/auth";
import { validateQuestClaim, findQuestById, markQuestClaimed } from "@/server/quests";
import { grantXp, type PlayerState } from "@/server/progression";
import { clientPromise } from "@/server/platform/database";
import { NotFoundError, ConflictError } from "@/server/platform/http";

export async function claimQuestReward(userId: string, questId: string): Promise<{ player: PlayerState; leveledUp: boolean } | undefined> {
  await syncUserQuests(userId, { now: new Date(), timeZone: await getUserTimeZone(userId) });

  const quest = await findQuestById(userId, questId);

  if (!quest) {
    throw new NotFoundError("Quest not found");
  }

  validateQuestClaim({ completed: quest.completed, claimed: quest.claimed });

  const client = await clientPromise;
  const session = client.startSession();

  try {
    return await session.withTransaction(async () => {
      const claimedNow = await markQuestClaimed(userId, quest, session);

      if (!claimedNow) {
        throw new ConflictError("Quest already claimed");
      }

      const entry = QUEST_ENTRY_BY_ID.get(quest.questTemplateId);
      if (entry) {
        return await grantXp({
          userId,
          source: { type: "quest_claim", id: quest._id.toString() },
          amount: entry.xpReward,
          occurredAt: new Date(),
        }, session);
      }
    });
  } finally {
    await session.endSession();
  }
}
