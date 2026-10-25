import type { ClientSession } from "mongodb";
import {
  getCollection,
  userScopedRepository,
  MAX_FIND_LIMIT,
  type UserAchievementDoc,
  type UserOwnedDoc,
} from "@/server/platform/database";

type OwnedAchievementDoc = UserAchievementDoc & UserOwnedDoc;

const unlocks = userScopedRepository<OwnedAchievementDoc>("userAchievements");

export function findUnlocks(userId: string, session?: ClientSession): Promise<OwnedAchievementDoc[]> {
  return unlocks.find(userId, {}, { limit: MAX_FIND_LIMIT, session });
}

export function countUnlocks(userId: string): Promise<number> {
  return unlocks.count(userId, {});
}

// Returns only the ids this call inserted: a concurrent evaluation may have won the race.
export async function upsertUnlocks(
  userId: string,
  achievementIds: string[],
  unlockedDate: string,
  session: ClientSession,
): Promise<string[]> {
  const collection = await getCollection<UserAchievementDoc>("userAchievements");
  const result = await collection.bulkWrite(
    achievementIds.map((achievementId) => ({
      updateOne: {
        filter: { userId, achievementId },
        update: { $setOnInsert: { userId, achievementId, unlockedDate } },
        upsert: true,
      },
    })),
    { session },
  );
  return Object.keys(result.upsertedIds).map((index) => achievementIds[Number(index)]);
}
