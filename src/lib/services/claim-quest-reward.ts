import { syncUserQuests } from "@/lib/services/sync-user-quests";
import { validateQuestClaim } from "@/lib/domain/quest-rules";
import { getUserQuestByIdFromDb, markUserQuestClaimedInDb, getQuestTemplateByIdFromDb } from "@/lib/data/quests-db";
import { grantXP } from "@/lib/data/user-db";

export async function claimQuestReward(userId: string, questId: string): Promise<void> {
  await syncUserQuests(userId);

  const quest = await getUserQuestByIdFromDb(questId, userId);
  
  if (!quest) {
    throw new Error("Quest not found");
  }

  // Validate using domain logic
  validateQuestClaim({ completed: quest.completed, claimed: quest.claimed });

  if (quest._id) {
     // Update in DB
     await markUserQuestClaimedInDb(quest._id.toString());
  }

  // Apply side effects
  const template = await getQuestTemplateByIdFromDb(quest.questTemplateId);
  if (template) {
    await grantXP(userId, template.xpReward);
  }
}
