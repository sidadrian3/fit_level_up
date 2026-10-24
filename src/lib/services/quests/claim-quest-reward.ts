import { syncUserQuests } from "@/lib/services/quests/sync-user-quests";
import { getUserTimeZone } from "@/server/platform/auth";
import { validateQuestClaim } from "@/lib/domain/quest-rules";
import { getUserQuestByIdFromDb, markUserQuestClaimedInDb, getQuestTemplateByIdFromDb } from "@/lib/data/quests-db";
import { grantXp, type PlayerState } from "@/server/progression";
import { clientPromise } from "@/server/platform/database";
import { NotFoundError, ConflictError } from "@/server/platform/http";

export async function claimQuestReward(userId: string, questId: string): Promise<{ player: PlayerState; leveledUp: boolean } | undefined> {
  await syncUserQuests(userId, { now: new Date(), timeZone: await getUserTimeZone(userId) });

  const quest = await getUserQuestByIdFromDb(questId, userId);

  if (!quest) {
    throw new NotFoundError("Quest not found");
  }

  // Validate using domain logic
  validateQuestClaim({ completed: quest.completed, claimed: quest.claimed });

  if (quest._id) {
    const client = await clientPromise;
    const session = client.startSession();

    try {
      return await session.withTransaction(async () => {
        // Update in DB
        const modifiedCount = await markUserQuestClaimedInDb(quest._id!, userId, session);

        if (modifiedCount === 0) {
          throw new ConflictError("Quest already claimed");
        }

        // Apply side effects
        const template = await getQuestTemplateByIdFromDb(quest.questTemplateId, session);
        if (template) {
          return await grantXp({
            userId,
            source: { type: "quest_claim", id: quest._id!.toString() },
            amount: template.xpReward,
            occurredAt: new Date(),
          }, session);
        }
      });
    } finally {
      await session.endSession();
    }
  }
}
