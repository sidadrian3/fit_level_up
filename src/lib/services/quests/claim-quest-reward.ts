import { syncUserQuests } from "@/lib/services/quests/sync-user-quests";
import { getUserTimeZoneFromDb } from "@/lib/data/user-db";
import { validateQuestClaim } from "@/lib/domain/quest-rules";
import { getUserQuestByIdFromDb, markUserQuestClaimedInDb, getQuestTemplateByIdFromDb } from "@/lib/data/quests-db";
import { grantUserXP } from "@/lib/services/users/grant-user-xp";
import { clientPromise } from "@/server/platform/database";
import type { User } from "@/lib/types";
import { NotFoundError, ConflictError } from "@/lib/api/errors";

export async function claimQuestReward(userId: string, questId: string): Promise<{ user: User; levelUp: boolean } | undefined> {
  await syncUserQuests(userId, { now: new Date(), timeZone: await getUserTimeZoneFromDb(userId) });

  const quest = await getUserQuestByIdFromDb(questId, userId);

  if (!quest) {
    throw new NotFoundError("Quest not found");
  }

  // Validate using domain logic
  validateQuestClaim({ completed: quest.completed, claimed: quest.claimed });

  if (quest._id) {
    const client = await clientPromise;
    const session = client.startSession();

    try {
      return await session.withTransaction(async () => {
        // Update in DB
        const modifiedCount = await markUserQuestClaimedInDb(quest._id!, userId, session);

        if (modifiedCount === 0) {
          throw new ConflictError("Quest already claimed");
        }

        // Apply side effects
        const template = await getQuestTemplateByIdFromDb(quest.questTemplateId, session);
        if (template) {
          return await grantUserXP(userId, template.xpReward, session);
        }
      });
    } finally {
      await session.endSession();
    }
  }
}
