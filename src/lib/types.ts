export interface User {
    name: string;
    avatar: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    streak: number;
    totalWorkouts: number;
    totalDistance: number; //km
    joinDate: string;
}

export interface Exercise {
    name: string;
    sets: number;
    reps: number;
    weight: number;
}

export interface Workout {
    id: string;
    type: "strength" | "cardio" | "hiit" | "flexibility";
    title: string;
    exercises: Exercise[];
    duration: number;       // minutes
    xpEarned: number;
    date: string;
}


export interface Run {
    id: string;
    distance: number;       // km
    duration: number;       // minutes
    pace: number;           // min/km
    difficulty: "easy" | "moderate" | "hard" | "intense";
    xpEarned: number;
    date: string;
}

export interface Quest {
    id: string;
    title: string;
    description: string;
    category: "daily" | "weekly" | "special";
    xpReward: number;
    progress: number;
    total: number;
    completed: boolean;
    icon: string;
}
export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    unlocked: boolean;
    unlockedDate?: string;
}
export interface DashboardStats {
    weeklyWorkouts: number;
    weeklyDistance: number;
    totalAchievements: number;
    lifetimeXP: number;
}

