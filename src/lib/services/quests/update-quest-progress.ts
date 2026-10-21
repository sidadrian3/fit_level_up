import type { QuestActivity } from "@/lib/types";
import { getQuestProgressUpdates, getPeriodForCategory, calcNextProgress } from "@/lib/domain/quest-rules";
import {
  updateUserQuestProgressInDb,
  getUserQuestsForUserFromDb, getQuestTemplatesByMetricsFromDb
} from "@/lib/data/quests-db";
import { toLocalDay } from "@/lib/utils/dates";
import { ensureUserQuestRows, type QuestCalendar } from "@/lib/services/quests/sync-user-quests";
import { ClientSession } from "mongodb";

// The session is required: read-then-write is only race-free because a conflicting transaction is aborted and retried
export async function updateQuestProgress(
  userId: string,
  activity: QuestActivity,
  calendar: QuestCalendar,
  session: ClientSession
): Promise<void> {

  const updates = getQuestProgressUpdates(activity);
  const metrics = updates.map(u => u.metric);

  const matchingTemplates = await getQuestTemplatesByMetricsFromDb(metrics, session);
  await ensureUserQuestRows(userId, matchingTemplates, calendar, session);
  const userQuests = await getUserQuestsForUserFromDb(userId, toLocalDay(calendar.now, calendar.timeZone), session);

  for (const update of updates) {
    const templatesForUpdate = matchingTemplates.filter(t => t.metric === update.metric);

    for (const template of templatesForUpdate) {
      if (!template._id) {
        continue;
      }

      const { periodStart, periodEnd } = getPeriodForCategory(template.category, calendar.now, calendar.timeZone);
      const questTemplateId = template._id.toString();

      const userQuest = userQuests.find(uq =>
        uq.questTemplateId === questTemplateId &&
        uq.periodStart === periodStart &&
        uq.periodEnd === periodEnd
      );

      if (!userQuest?._id || userQuest.completed) {
        continue;
      }

      const nextProgress = calcNextProgress(userQuest.progress, update.amount, userQuest.target);
      const isCompleted = nextProgress >= userQuest.target;

      await updateUserQuestProgressInDb(userQuest._id, userId, nextProgress, isCompleted, session);
    }
  }
}
