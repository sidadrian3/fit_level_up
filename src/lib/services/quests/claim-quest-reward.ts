import { syncUserQuests } from "@/lib/services/quests/sync-user-quests";
import { validateQuestClaim } from "@/lib/domain/quest-rules";
import { getUserQuestByIdFromDb, markUserQuestClaimedInDb, getQuestTemplateByIdFromDb } from "@/lib/data/quests-db";
import { grantUserXP } from "@/lib/services/users/grant-user-xp";
import clientPromise from "@/lib/mongodb";

export async function claimQuestReward(userId: string, questId: string): Promise<any> {
  await syncUserQuests(userId);

  const quest = await getUserQuestByIdFromDb(questId, userId);

  if (!quest) {
    throw new Error("Quest not found");
  }

  // Validate using domain logic
  validateQuestClaim({ completed: quest.completed, claimed: quest.claimed });

  if (quest._id) {
    const client = await clientPromise;
    const session = client.startSession();

    try {
      return await session.withTransaction(async () => {
        // Update in DB
        const modifiedCount = await markUserQuestClaimedInDb(quest._id!.toString(), session);

        if (modifiedCount === 0) {
          throw new Error("Quest already claimed");
        }

        // Apply side effects
        const template = await getQuestTemplateByIdFromDb(quest.questTemplateId);
        if (template) {
          return await grantUserXP(userId, template.xpReward, session);
        }
      });
    } finally {
      await session.endSession();
    }
  }
}
