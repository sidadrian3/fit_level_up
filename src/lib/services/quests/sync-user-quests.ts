import {
  getActiveQuestTemplatesFromDb,
  bulkUpsertUserQuestsToDb,
} from "@/lib/data/quests-db";
import { getPeriodForCategory } from "@/lib/domain/quest-rules";

export async function syncUserQuests(userId: string): Promise<void> {
  const activeTemplates = await getActiveQuestTemplatesFromDb();

  // Group templates by category to determine their period
  const periodMap = new Map<
    string,
    { periodStart: string; periodEnd: string }
  >();
  for (const template of activeTemplates) {
    if (!periodMap.has(template.category)) {
      periodMap.set(template.category, getPeriodForCategory(template.category));
    }
  }

  // Figure out the quests that should exist for this period
  const questsToUpsert = [];
  for (const template of activeTemplates) {
    if (!template._id) continue;
    const { periodStart, periodEnd } = periodMap.get(template.category)!;

    questsToUpsert.push({
      userId,
      questTemplateId: template._id.toString(),
      progress: 0,
      target: template.target,
      completed: false,
      claimed: false,
      periodStart,
      periodEnd,
    });
  }

  // BATCH: Upsert all quests in one atomic operation (no duplicates due to $setOnInsert)
  if (questsToUpsert.length > 0) {
    await bulkUpsertUserQuestsToDb(questsToUpsert);
  }
}
