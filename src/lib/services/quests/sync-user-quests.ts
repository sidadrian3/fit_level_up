import { getActiveQuestTemplatesFromDb, getUserQuestsForUserFromDb, bulkInsertUserQuestsToDb } from "@/lib/data/quests-db";
import { getPeriodForCategory } from "@/lib/domain/quest-rules";

export async function syncUserQuests(userId: string): Promise<void> {
  const activeTemplates = await getActiveQuestTemplatesFromDb();

  // Group templates by category to determine their period
  const periodMap = new Map<string, { periodStart: string; periodEnd: string }>();
  for (const template of activeTemplates) {
    if (!periodMap.has(template.category)) {
      periodMap.set(template.category, getPeriodForCategory(template.category));
    }
  }

  // BATCH: Fetch all existing user quests for this user (for current periods)
  const existingQuests = await getUserQuestsForUserFromDb(userId);
  const existingKeys = new Set(
    existingQuests.map(uq => `${uq.questTemplateId}:${uq.periodStart}:${uq.periodEnd}`)
  );

  // Figure out which quests are missing
  const missingQuests = [];
  for (const template of activeTemplates) {
    if (!template._id) continue;
    const { periodStart, periodEnd } = periodMap.get(template.category)!;
    const key = `${template._id.toString()}:${periodStart}:${periodEnd}`;

    if (!existingKeys.has(key)) {
      missingQuests.push({
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
  }

  // BATCH: Insert all missing quests in one operation
  if (missingQuests.length > 0) {
    await bulkInsertUserQuestsToDb(missingQuests);
  }
}
