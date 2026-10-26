import type { AchievementRarity } from "../achievement-definitions";

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    rarity: AchievementRarity;
    unlocked: boolean;
    unlockedDate?: string;
}
