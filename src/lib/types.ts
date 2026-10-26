import type { AchievementRarity } from "@/shared/achievement-definitions";

/** Type alias for ISO date strings (activity `date`s are full instants) — makes refactoring to Date objects easier later */
export type DateString = string;

export interface Run {
    id: string;
    distance: number;       // km
    duration: number;       // minutes
    pace: number;           // min/km
    difficulty: "easy" | "moderate" | "hard" | "intense";
    xpEarned: number;
    date: DateString;
}

export type CreateRunInput = {
    distance: number;
    duration: number;
    difficulty: Run["difficulty"];
}


export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    rarity: AchievementRarity;
    unlocked: boolean;
    unlockedDate?: DateString;
}
