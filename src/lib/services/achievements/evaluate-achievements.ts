// APPLICATION SERVICE — orchestrates domain logic + persistence for achievement evaluation

import type { Achievement } from "@/lib/types";
import { getUserFromDb } from "@/lib/data/user-db";
import {
  getAchievementDefinitions,
  getUserUnlocks,
  insertUserAchievements,
} from "@/lib/data/achievements-db";
import type { UserAchievementDoc } from "@/lib/data/achievements-db";
import { isConditionMet } from "@/lib/domain/achievement-rules";
import { ClientSession } from "mongodb";

export async function evaluateAchievements(
  userId: string,
  session?: ClientSession
): Promise<Achievement[]> {
  // Get user data directly from DB (NOT through getUser service — avoids circular dep)
  const user = await getUserFromDb(userId);

  // Fetch all definitions and user's existing unlocks
  const [definitions, unlocked] = await Promise.all([
    getAchievementDefinitions(),
    getUserUnlocks(userId),
  ]);

  const unlockedIds = new Set(unlocked.map((u) => u.achievementId));
  const lockedDefinitions = definitions.filter((def) => !unlockedIds.has(def.id));

  const now = new Date().toISOString();
  const newlyUnlockedDocs: UserAchievementDoc[] = [];
  const newlyUnlockedAchievements: Achievement[] = [];

  for (const def of lockedDefinitions) {
    if (isConditionMet(def.condition, user)) {
      newlyUnlockedDocs.push({
        userId,
        achievementId: def.id,
        unlockedDate: now,
      });

      newlyUnlockedAchievements.push({
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        rarity: def.rarity,
        unlocked: true,
        unlockedDate: now,
      });
    }
  }

  if (newlyUnlockedDocs.length > 0) {
    await insertUserAchievements(newlyUnlockedDocs, session);
    console.log(`User ${userId} unlocked ${newlyUnlockedDocs.length} new achievements!`);
  }

  return newlyUnlockedAchievements;
}
