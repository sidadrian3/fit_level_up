import type { Quest } from "@/lib/types";
import { toLocalDay } from "@/lib/utils/dates";
import { getUserTimeZoneFromDb } from "@/lib/data/user-db";
import { syncUserQuests } from "@/lib/services/quests/sync-user-quests";
import { getUserQuestsForUserFromDb, getQuestTemplatesByIdsFromDb, toQuestView } from "@/lib/data/quests-db";

export async function getUserQuests(userId: string): Promise<Quest[]> {
  const calendar = { now: new Date(), timeZone: await getUserTimeZoneFromDb(userId) };
  await syncUserQuests(userId, calendar);

  const userQuests = await getUserQuestsForUserFromDb(userId, toLocalDay(calendar.now, calendar.timeZone));

  if (userQuests.length === 0) {
    return [];
  }

  const templateIds = [...new Set(userQuests.map(uq => uq.questTemplateId))];
  const templates = await getQuestTemplatesByIdsFromDb(templateIds);
  const templateMap = new Map(templates.map(t => [t._id?.toString(), t]));

  const quests: Quest[] = [];

  for (const userQuest of userQuests) {
    const template = templateMap.get(userQuest.questTemplateId);
    if (!template) {
      continue;
    }
    quests.push(toQuestView(userQuest, template));
  }

  return quests;
}
