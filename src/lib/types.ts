import type { AchievementRarity } from "@/shared/achievement-definitions";

/** Type alias for ISO date strings (activity `date`s are full instants) — makes refactoring to Date objects easier later */
export type DateString = string;

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    rarity: AchievementRarity;
    unlocked: boolean;
    unlockedDate?: DateString;
}
