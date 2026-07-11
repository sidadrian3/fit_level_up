import type { QuestActivity } from "@/lib/types";
import { syncUserQuests } from "@/lib/services/quests/sync-user-quests";
import { getQuestProgressUpdates, getPeriodForCategory, calcNextProgress } from "@/lib/domain/quest-rules";
import {
  updateUserQuestProgressInDb,
  getUserQuestsForUserFromDb, getQuestTemplatesByMetricsFromDb
} from "@/lib/data/quests-db";
import { ClientSession } from "mongodb";

export async function updateQuestProgress(
  userId: string,
  activity: QuestActivity,
  session?: ClientSession
): Promise<void> {
  await syncUserQuests(userId);

  const updates = getQuestProgressUpdates(activity);
  const metrics = updates.map(u => u.metric);

  // BATCH: Get all templates matching ANY of the metrics
  const matchingTemplates = await getQuestTemplatesByMetricsFromDb(metrics);
  // BATCH: Get all user quests for this user
  const userQuests = await getUserQuestsForUserFromDb(userId);


  for (const update of updates) {
    const templatesForUpdate = matchingTemplates.filter(t => t.metric === update.metric);

    for (const template of templatesForUpdate) {
      if (!template._id) {
        continue;
      }

      const { periodStart, periodEnd } = getPeriodForCategory(template.category);
      const questTemplateId = template._id.toString();

      const userQuest = userQuests.find(uq =>
        uq.questTemplateId === questTemplateId &&
        uq.periodStart === periodStart &&
        uq.periodEnd === periodEnd
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
        await updateUserQuestProgressInDb(userQuest._id.toString(), nextProgress, isCompleted, session);
      }
    }
  }
}
