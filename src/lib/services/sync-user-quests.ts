import { getActiveQuestTemplatesFromDb, findUserQuestFromDb, insertUserQuestToDb } from "@/lib/data/quests-db";
import { getPeriodForCategory } from "@/lib/domain/quest-rules";

export async function syncUserQuests(userId: string): Promise<void> {
  const activeTemplates = await getActiveQuestTemplatesFromDb();

  for (const template of activeTemplates) {
    if (!template._id) {
      continue;
    }

    const { periodStart, periodEnd } = getPeriodForCategory(template.category);
    const questTemplateId = template._id.toString();

    const existingQuest = await findUserQuestFromDb(
      userId,
      questTemplateId,
      periodStart,
      periodEnd
    );

    if (existingQuest) {
      continue;
    }

    await insertUserQuestToDb({
      userId,
      questTemplateId,
      progress: 0,
      target: template.target,
      completed: false,
      claimed: false,
      periodStart,
      periodEnd,
    });
  }
}
