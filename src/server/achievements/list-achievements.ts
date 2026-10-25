import { ACHIEVEMENT_DEFINITIONS } from "@/shared/achievement-definitions";
import type { Achievement } from "@/lib/types";
import { countUnlocks, findUnlocks } from "./achievement.repository";

export async function listAchievements(userId: string): Promise<Achievement[]> {
  const unlocks = await findUnlocks(userId);
  const unlockedDateById = new Map(unlocks.map((unlock) => [unlock.achievementId, unlock.unlockedDate]));

  return ACHIEVEMENT_DEFINITIONS.map(({ id, title, description, icon, rarity }) => ({
    id,
    title,
    description,
    icon,
    rarity,
    unlocked: unlockedDateById.has(id),
    unlockedDate: unlockedDateById.get(id),
  }));
}

export function countUnlockedAchievements(userId: string): Promise<number> {
  return countUnlocks(userId);
}
