import type { QuestActivity } from "@/lib/types";
import { syncUserQuests } from "@/lib/services/sync-user-quests";
import { getQuestProgressUpdates, getPeriodForCategory, calcNextProgress } from "@/lib/domain/quest-rules";
import { getQuestTemplatesByMetricFromDb, findUserQuestFromDb, updateUserQuestProgressInDb } from "@/lib/data/quests-db";

export async function updateQuestProgress(userId: string, activity: QuestActivity): Promise<void> {
  await syncUserQuests(userId);

  const updates = getQuestProgressUpdates(activity);

  for (const update of updates) {
    const matchingTemplates = await getQuestTemplatesByMetricFromDb(update.metric);

    for (const template of matchingTemplates) {
      if (!template._id) {
        continue;
      }

      const { periodStart, periodEnd } = getPeriodForCategory(template.category);
      const questTemplateId = template._id.toString();

      const userQuest = await findUserQuestFromDb(
        userId,
        questTemplateId,
        periodStart,
        periodEnd
      );

      if (!userQuest) {
        continue;
      }

      if (userQuest.completed) {
        continue;
      }

      const nextProgress = calcNextProgress(userQuest.progress, update.amount, userQuest.target);
      const isCompleted = nextProgress >= userQuest.target;

      if (userQuest._id) {
         await updateUserQuestProgressInDb(userQuest._id.toString(), nextProgress, isCompleted);
      }
    }
  }
}
