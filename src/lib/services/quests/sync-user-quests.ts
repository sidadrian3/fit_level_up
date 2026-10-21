import {
  getActiveQuestTemplatesFromDb,
  bulkUpsertUserQuestsToDb,
} from "@/lib/data/quests-db";
import type { QuestTemplateMongoDoc } from "@/lib/data/quests-db";
import { getPeriodForCategory } from "@/lib/domain/quest-rules";
import type { ClientSession } from "mongodb";

// Idempotent: $setOnInsert never touches a row that already exists
export async function ensureUserQuestRows(
  userId: string,
  templates: QuestTemplateMongoDoc[],
  session?: ClientSession
): Promise<void> {
  const rows = templates.flatMap((template) => {
    if (!template._id) return [];
    const { periodStart, periodEnd } = getPeriodForCategory(template.category);

    return [{
      userId,
      questTemplateId: template._id.toString(),
      progress: 0,
      target: template.target,
      completed: false,
      claimed: false,
      periodStart,
      periodEnd,
    }];
  });

  await bulkUpsertUserQuestsToDb(rows, session);
}

export async function syncUserQuests(userId: string): Promise<void> {
  await ensureUserQuestRows(userId, await getActiveQuestTemplatesFromDb());
}
