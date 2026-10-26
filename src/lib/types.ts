import type { AchievementRarity } from "@/shared/achievement-definitions";
import type { Exercise } from "@/shared/contracts/exercise";

/** Type alias for ISO date strings (activity `date`s are full instants) — makes refactoring to Date objects easier later */
export type DateString = string;

export interface Workout {
    id: string;
    title: string;
    exercises: Exercise[];
    duration: number;       // minutes
    xpEarned: number;
    date: DateString;
}

export type CreateWorkoutInput = {
    title: string;
    exercises: Exercise[];
    duration: number;
}

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
export interface DashboardStats {
    weeklyWorkouts: number;
    lastWeekWorkouts: number;
    weeklyDistance: number;
    totalAchievements: number;
    lifetimeXP: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
}
