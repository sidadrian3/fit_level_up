import type { Quest } from "@/lib/types";
import { syncUserQuests } from "@/lib/services/sync-user-quests";
import { getUserQuestsForUserFromDb, getQuestTemplatesByIdsFromDb, toQuestView } from "@/lib/data/quests-db";

export async function getUserQuests(userId: string): Promise<Quest[]> {
  // First ensure quests are synced
  await syncUserQuests(userId);

  const userQuests = await getUserQuestsForUserFromDb(userId);
  
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
