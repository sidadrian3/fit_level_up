import type { IndexDescription, ObjectId } from "mongodb";
import type { Exercise, TargetMuscle } from "@/shared/contracts/exercise";

export const COLLECTIONS = {
    user: "user",
    session: "session",
    account: "account",
    verification: "verification",
    workouts: "workouts",
    runs: "runs",
    questTemplates: "quest_templates",
    userQuests: "user_quests",
    achievements: "achievements",
    userAchievements: "user_achievements",
    customExercises: "custom_exercises",
    friendships: "friendships",
    workoutTemplates: "workout_templates",
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;

export type WorkoutDoc = {
    _id?: ObjectId;
    userId: string;
    title: string;
    exercises: Exercise[];
    duration: number;
    xpEarned: number;
    date: Date;
    idempotencyKey?: string;
};

export type RunDoc = {
    _id?: ObjectId;
    userId: string;
    distance: number;
    duration: number;
    pace: number;
    difficulty: "easy" | "moderate" | "hard" | "intense";
    xpEarned: number;
    date: Date;
    idempotencyKey?: string;
};

export interface CustomExerciseDoc {
    _id?: ObjectId;
    userId: string;
    name: string;
    targetMuscle: TargetMuscle;
}

export interface WorkoutTemplateDoc {
    _id?: ObjectId;
    userId: string;
    name: string;
    exercises: Exercise[];
    idempotencyKey: string;
    createdAt: string;
}

export type UserQuestDoc = {
    _id?: ObjectId;
    userId: string;
    questTemplateId: string;
    progress: number;
    target: number;
    completed: boolean;
    claimed: boolean;
    periodStart: string;
    periodEnd: string;
};

export type UserAchievementDoc = {
    _id?: ObjectId;
    userId: string;
    achievementId: string;
    unlockedDate: string;
};

export type FriendshipDoc = {
    _id?: ObjectId;
    requesterId: string;
    receiverId: string;
    pairKey: string;
    status: "pending" | "accepted" | "declined";
    createdAt: Date;
    updatedAt: Date;
};

// Owned by better-auth; named here for its type only.
export type UserDoc = {
    _id?: ObjectId;
    id?: string;
    email: string;
    name: string;
    image?: string;
    avatar?: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    streak: number;
    lastActivityDate?: Date;
    totalWorkouts: number;
    totalDistance: number;
    createdAt: Date;
    stamina: number;
    lastStaminaUpdate: Date;
    timeZone?: string;
    __v?: number;
};

type SchemaCollection = {
    indexes: (IndexDescription & { name: string })[];
};

const idempotencyIndex = (name: string) => ({
    key: { userId: 1, idempotencyKey: 1 },
    name,
    unique: true,
    partialFilterExpression: { idempotencyKey: { $exists: true } },
});

export const SCHEMA: Record<
    | "workouts"
    | "runs"
    | "questTemplates"
    | "userQuests"
    | "userAchievements"
    | "customExercises"
    | "friendships"
    | "workoutTemplates",
    SchemaCollection
> = {
    workouts: {
        indexes: [
            { key: { userId: 1, date: -1 }, name: "idx_workouts_userId_date" },
            idempotencyIndex("idx_workouts_idempotencyKey"),
        ],
    },
    runs: {
        indexes: [
            { key: { userId: 1, date: -1 }, name: "idx_runs_userId_date" },
            idempotencyIndex("idx_runs_idempotencyKey"),
        ],
    },
    questTemplates: {
        indexes: [
            { key: { isActive: 1, metric: 1 }, name: "idx_questTemplates_active_metric" },
        ],
    },
    userQuests: {
        indexes: [
            {
                key: { userId: 1, questTemplateId: 1, periodStart: 1, periodEnd: 1 },
                name: "idx_userQuests_sync_lookup",
                unique: true,
            },
            { key: { userId: 1 }, name: "idx_userQuests_userId" },
        ],
    },
    userAchievements: {
        indexes: [
            { key: { userId: 1 }, name: "idx_userAchievements_userId" },
            {
                key: { userId: 1, achievementId: 1 },
                name: "idx_userAchievements_unique",
                unique: true,
            },
        ],
    },
    customExercises: {
        indexes: [
            { key: { userId: 1 }, name: "idx_customExercises_userId" },
            {
                key: { userId: 1, name: 1, targetMuscle: 1 },
                name: "idx_customExercises_unique",
                unique: true,
            },
        ],
    },
    friendships: {
        indexes: [
            { key: { pairKey: 1 }, name: "idx_friendships_pairKey", unique: true },
            {
                key: { requesterId: 1, receiverId: 1 },
                name: "idx_friendships_requester_receiver",
                unique: true,
            },
            { key: { receiverId: 1, status: 1 }, name: "idx_friendships_receiver_status" },
            { key: { requesterId: 1, status: 1 }, name: "idx_friendships_requester_status" },
            {
                key: { receiverId: 1, requesterId: 1, status: 1 },
                name: "idx_friendships_status",
            },
        ],
    },
    workoutTemplates: {
        indexes: [
            { key: { userId: 1 }, name: "idx_workoutTemplates_userId" },
            idempotencyIndex("idx_workoutTemplates_idempotencyKey"),
        ],
    },
};

export const RETIRED_INDEXES: { collection: CollectionKey; name: string }[] = [];
