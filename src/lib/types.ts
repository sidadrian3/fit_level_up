import { PersonalRecord } from "./utils";
import { TargetMuscle, type Exercise } from "@/shared/contracts/exercise";

export { TargetMuscle };
export type { Exercise };

/** Type alias for ISO date strings — makes refactoring to Date objects easier later */
export type DateString = string;

export interface User {
    id: string;
    email: string;
    name: string;
    avatar: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    streak: number;
    totalWorkouts: number;
    totalDistance: number; //km
    joinDate: DateString;
    lastActivityDate?: DateString;
    stamina: number;
    lastStaminaUpdate: DateString;
    timeZone: string;
    __v?: number;
}

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
    idempotencyKey?: string;
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
    idempotencyKey?: string;
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
    idempotencyKey?: string;
}


export interface Quest {
    id: string;
    title: string;
    description: string;
    category: "daily" | "weekly" | "special";
    xpReward: number;
    progress: number;
    target: number;
    completed: boolean;
    claimed: boolean;
    icon: string;
}

export type QuestCategory = "daily" | "weekly" | "special";

export type QuestMetric =
    | "workout_count"
    | "run_count"
    | "run_distance";


export type QuestActivity =
    | {
        type: "workout_created";
        xpEarned: number;
    }
    | {
        type: "run_created";
        distance: number;
        xpEarned: number;
    };



export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    rarity: "common" | "rare" | "epic" | "legendary";
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

export type FriendshipStatus = "pending" | "accepted" | "declined";

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: FriendshipStatus;
  createdAt: DateString;
}

export interface FriendProfile {
  userId: string;
  name: string;
  avatar: string;
  level: number;
  streak: number;
  totalWorkouts: number;
  totalDistance: number;
  personalRecords: PersonalRecord[];
  friendship: Friendship;
}

