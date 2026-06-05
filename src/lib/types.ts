/** Type alias for ISO date strings — makes refactoring to Date objects easier later */
export type DateString = string;

export interface User {
    name: string;
    avatar: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    streak: number;
    totalWorkouts: number;
    totalDistance: number; //km
    joinDate: DateString;
}

export interface Exercise {
    name: string;
    sets: number;
    reps: number;
    weight: number | null; // null for bodyweight exercises
}

export interface Workout {
    id: string;
    type: "strength" | "cardio" | "hiit" | "flexibility";
    title: string;
    exercises: Exercise[];
    duration: number;       // minutes
    xpEarned: number;
    date: DateString;
}

export type CreateWorkoutInput = {
    type: Workout["type"];
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

export type QuestTemplateDoc = {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  metric: QuestMetric;
  target: number;
  xpReward: number;
  icon: string;
  isActive: boolean;
};

export type UserQuestDoc = {
  id: string;
  userId: string;
  questTemplateId: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  periodStart: string;
  periodEnd: string;
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
    weeklyDistance: number;
    totalAchievements: number;
    lifetimeXP: number;
}
