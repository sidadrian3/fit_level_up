import type { Document, IndexDescription, ObjectId } from "mongodb";
import { TargetMuscle, type Exercise } from "@/shared/contracts/exercise";

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
    schemaMigrations: "schema_migrations",
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
    validator?: { $jsonSchema: Document };
};

const string = { bsonType: "string" } as const;
const number = { bsonType: "number" } as const;
const bool = { bsonType: "bool" } as const;
const date = { bsonType: "date" } as const;
const array = { bsonType: "array" } as const;

const objectSchema = (
    properties: Record<string, Document>,
    required: readonly string[]
) => ({
    $jsonSchema: { bsonType: "object", required: [...required], properties },
});

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
        validator: objectSchema(
            { userId: string, title: string, exercises: array, duration: number, xpEarned: number, date, idempotencyKey: string },
            ["userId", "title", "exercises", "duration", "xpEarned", "date"]
        ),
    },
    runs: {
        indexes: [
            { key: { userId: 1, date: -1 }, name: "idx_runs_userId_date" },
            idempotencyIndex("idx_runs_idempotencyKey"),
        ],
        validator: objectSchema(
            {
                userId: string,
                distance: number,
                duration: number,
                pace: number,
                xpEarned: number,
                difficulty: { enum: ["easy", "moderate", "hard", "intense"] },
                date,
                idempotencyKey: string,
            },
            ["userId", "distance", "duration", "pace", "xpEarned", "difficulty", "date"]
        ),
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
        validator: objectSchema(
            {
                userId: string,
                questTemplateId: string,
                periodStart: string,
                periodEnd: string,
                progress: number,
                target: number,
                completed: bool,
                claimed: bool,
            },
            ["userId", "questTemplateId", "periodStart", "periodEnd", "progress", "target", "completed", "claimed"]
        ),
    },
    userAchievements: {
        indexes: [
            {
                key: { userId: 1, achievementId: 1 },
                name: "idx_userAchievements_unique",
                unique: true,
            },
        ],
        validator: objectSchema(
            { userId: string, achievementId: string, unlockedDate: string },
            ["userId", "achievementId", "unlockedDate"]
        ),
    },
    customExercises: {
        indexes: [
            {
                key: { userId: 1, name: 1, targetMuscle: 1 },
                name: "idx_customExercises_unique",
                unique: true,
            },
        ],
        validator: objectSchema(
            { userId: string, name: string, targetMuscle: { enum: Object.values(TargetMuscle) } },
            ["userId", "name", "targetMuscle"]
        ),
    },
    friendships: {
        indexes: [
            { key: { pairKey: 1 }, name: "idx_friendships_pairKey", unique: true },
            { key: { receiverId: 1, status: 1 }, name: "idx_friendships_receiver_status" },
            { key: { requesterId: 1, status: 1 }, name: "idx_friendships_requester_status" },
            {
                key: { receiverId: 1, requesterId: 1, status: 1 },
                name: "idx_friendships_status",
            },
        ],
        validator: objectSchema(
            {
                requesterId: string,
                receiverId: string,
                pairKey: string,
                status: { enum: ["pending", "accepted", "declined"] },
                createdAt: date,
                updatedAt: date,
            },
            ["requesterId", "receiverId", "pairKey", "status", "createdAt", "updatedAt"]
        ),
    },
    workoutTemplates: {
        indexes: [
            { key: { userId: 1 }, name: "idx_workoutTemplates_userId" },
            idempotencyIndex("idx_workoutTemplates_idempotencyKey"),
        ],
        validator: objectSchema(
            { userId: string, name: string, idempotencyKey: string, createdAt: string, exercises: array },
            ["userId", "name", "idempotencyKey", "createdAt", "exercises"]
        ),
    },
};

export const RETIRED_INDEXES: { collection: CollectionKey; name: string }[] = [
    // retired in 2.1: superseded by pairKey
    { collection: "friendships", name: "idx_friendships_requester_receiver" },
    // retired in 2.1: prefix of a unique index
    { collection: "userAchievements", name: "idx_userAchievements_userId" },
    // retired in 2.1: prefix of a unique index
    { collection: "customExercises", name: "idx_customExercises_userId" },
];
