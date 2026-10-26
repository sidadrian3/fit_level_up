import type { AchievementRarity } from "@/shared/achievement-definitions";
import { TargetMuscle, type Exercise } from "@/shared/contracts/exercise";

export { TargetMuscle };
export type { Exercise };

/** Type alias for ISO date strings (activity `date`s are full instants) — makes refactoring to Date objects easier later */
export type DateString = string;

export interface CustomExercise {
    id: string;
    userId: string;
    name: string;
    targetMuscle: TargetMuscle;
}

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

export interface WorkoutTemplate {
    id: string;
    userId: string;
    name: string;
    exercises: Exercise[];
    createdAt: DateString;
}

export type CreateWorkoutTemplateInput = {
    name: string;
    exercises: Exercise[];
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
