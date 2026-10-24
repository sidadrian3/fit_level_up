import type { Quest } from "@/lib/types";
import { toLocalDay } from "@/shared/time/calendar";
import { getUserTimeZone } from "@/server/platform/auth";
import { QUEST_ENTRY_BY_ID, syncUserQuests, type QuestEntry } from "@/lib/services/quests/sync-user-quests";
import { getUserQuestsForUserFromDb } from "@/lib/data/quests-db";
import type { UserQuestDoc } from "@/server/platform/database";

function toQuestView(id: string, userQuest: UserQuestDoc, entry: QuestEntry): Quest {
  return {
    id,
    title: entry.title,
    description: entry.description,
    category: entry.category,
    progress: userQuest.progress,
    target: userQuest.target,
    xpReward: entry.xpReward,
    completed: userQuest.completed,
    claimed: userQuest.claimed,
    icon: entry.icon,
  };
}

export async function getUserQuests(userId: string): Promise<Quest[]> {
  const calendar = { now: new Date(), timeZone: await getUserTimeZone(userId) };
  await syncUserQuests(userId, calendar);

  const userQuests = await getUserQuestsForUserFromDb(userId, toLocalDay(calendar.now, calendar.timeZone));

  const quests: Quest[] = [];
  for (const userQuest of userQuests) {
    const entry = QUEST_ENTRY_BY_ID.get(userQuest.questTemplateId);
    if (!entry || !userQuest._id) continue;
    quests.push(toQuestView(userQuest._id.toString(), userQuest, entry));
  }
  return quests;
}
