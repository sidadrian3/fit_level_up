import { QUEST_DEFINITIONS, getQuestDefinition, getPeriodForCategory, upsertQuestRows, type QuestCalendar, type QuestId } from "@/server/quests";
import type { ClientSession } from "mongodb";

export type QuestEntry = { id: QuestId } & ReturnType<typeof getQuestDefinition>;

export const QUEST_ENTRIES: QuestEntry[] = (Object.keys(QUEST_DEFINITIONS) as QuestId[]).map((id) => ({
  id,
  ...getQuestDefinition(id),
}));

// Rows persist the definition id as a plain string, so lookups from stored data go through a string-keyed map
export const QUEST_ENTRY_BY_ID: ReadonlyMap<string, QuestEntry> = new Map(QUEST_ENTRIES.map((entry) => [entry.id, entry]));

// Idempotent: $setOnInsert never touches a row that already exists
export async function ensureUserQuestRows(
  userId: string,
  entries: QuestEntry[],
  calendar: QuestCalendar,
  session?: ClientSession
): Promise<void> {
  const rows = entries.map((entry) => {
    const { periodStart, periodEnd } = getPeriodForCategory(entry.category, calendar.now, calendar.timeZone);

    return {
      questTemplateId: entry.id,
      progress: 0,
      target: entry.target,
      completed: false,
      claimed: false,
      periodStart,
      periodEnd,
    };
  });

  await upsertQuestRows(userId, rows, session);
}

export async function syncUserQuests(userId: string, calendar: QuestCalendar): Promise<void> {
  await ensureUserQuestRows(userId, QUEST_ENTRIES, calendar);
}
