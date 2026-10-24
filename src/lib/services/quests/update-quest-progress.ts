import type { QuestActivity } from "@/lib/types";
import {
  getQuestProgressUpdates,
  getPeriodForCategory,
  calcNextProgress,
  findActiveQuests,
  setQuestProgress,
  type QuestCalendar,
} from "@/server/quests";
import { toLocalDay } from "@/shared/time/calendar";
import { QUEST_ENTRIES, ensureUserQuestRows } from "@/lib/services/quests/sync-user-quests";
import { ClientSession } from "mongodb";

// The session is required: read-then-write is only race-free because a conflicting transaction is aborted and retried
export async function updateQuestProgress(
  userId: string,
  activity: QuestActivity,
  calendar: QuestCalendar,
  session: ClientSession
): Promise<void> {

  const updates = getQuestProgressUpdates(activity);
  const metrics = new Set(updates.map(u => u.metric));

  const matchingEntries = QUEST_ENTRIES.filter(entry => metrics.has(entry.metric));
  await ensureUserQuestRows(userId, matchingEntries, calendar, session);
  const userQuests = await findActiveQuests(userId, toLocalDay(calendar.now, calendar.timeZone), session);

  for (const update of updates) {
    for (const entry of matchingEntries.filter(e => e.metric === update.metric)) {
      const { periodStart, periodEnd } = getPeriodForCategory(entry.category, calendar.now, calendar.timeZone);

      const userQuest = userQuests.find(uq =>
        uq.questTemplateId === entry.id &&
        uq.periodStart === periodStart &&
        uq.periodEnd === periodEnd
      );

      if (!userQuest || userQuest.completed) {
        continue;
      }

      const nextProgress = calcNextProgress(userQuest.progress, update.amount, userQuest.target);
      const isCompleted = nextProgress >= userQuest.target;

      await setQuestProgress(userId, userQuest._id.toString(), nextProgress, isCompleted, session);
    }
  }
}
