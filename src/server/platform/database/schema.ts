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
    outbox: "outbox",
    playerProfiles: "player_profiles",
    xpLedger: "xp_ledger",
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
    idempotencyFingerprint?: string;
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
    idempotencyFingerprint?: string;
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
    idempotencyFingerprint?: string;
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

export type OutboxDoc<T extends string = string, P = Document> = {
    _id?: ObjectId;
    type: T;
    payload: P;
    status: "pending" | "done" | "dead";
    availableAt: Date;
    attempts: number;
    completedListeners: string[];
    lastError: string | null;
    createdAt: Date;
    processedAt: Date | null;
};

export type PlayerProfileDoc = {
    _id: string;
    totalXp: number;
    streak: number;
    lastActivityDay: string | null;
    stamina: number;
    lastStaminaUpdate: Date;
    totalWorkouts: number;
    totalDistance: number;
    createdAt: Date;
    updatedAt: Date;
};

export type XpSourceType = "workout" | "run" | "quest_claim";

export type XpLedgerDoc = {
    _id?: ObjectId;
    userId: string;
    sourceType: XpSourceType;
    sourceId: string;
    amount: number;
    occurredAt: Date;
    createdAt: Date;
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
    | "workoutTemplates"
    | "outbox"
    | "playerProfiles"
    | "xpLedger",
    SchemaCollection
> = {
    workouts: {
        indexes: [
            { key: { userId: 1, date: -1 }, name: "idx_workouts_userId_date" },
            idempotencyIndex("idx_workouts_idempotencyKey"),
        ],
        validator: objectSchema(
            { userId: string, title: string, exercises: array, duration: number, xpEarned: number, date, idempotencyKey: string, idempotencyFingerprint: string },
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
                idempotencyFingerprint: string,
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
            { userId: string, name: string, idempotencyKey: string, idempotencyFingerprint: string, createdAt: string, exercises: array },
            ["userId", "name", "idempotencyKey", "createdAt", "exercises"]
        ),
    },
    outbox: {
        indexes: [
            {
                key: { availableAt: 1 },
                name: "idx_outbox_pending",
                partialFilterExpression: { status: "pending" },
            },
            {
                key: { processedAt: 1 },
                name: "idx_outbox_done_ttl",
                expireAfterSeconds: 604800,
                partialFilterExpression: { status: "done" },
            },
        ],
        validator: objectSchema(
            {
                type: string,
                payload: { bsonType: "object" },
                status: { enum: ["pending", "done", "dead"] },
                availableAt: date,
                attempts: number,
                completedListeners: array,
                lastError: { bsonType: ["string", "null"] },
                createdAt: date,
                processedAt: { bsonType: ["date", "null"] },
            },
            ["type", "payload", "status", "availableAt", "attempts", "completedListeners", "lastError", "createdAt", "processedAt"]
        ),
    },
    playerProfiles: {
        indexes: [],
        validator: objectSchema(
            {
                _id: string,
                totalXp: number,
                streak: number,
                stamina: number,
                lastActivityDay: { bsonType: ["string", "null"] },
                lastStaminaUpdate: date,
                createdAt: date,
                updatedAt: date,
                totalWorkouts: number,
                totalDistance: number,
            },
            ["_id", "totalXp", "streak", "stamina", "lastActivityDay", "lastStaminaUpdate", "createdAt", "updatedAt", "totalWorkouts", "totalDistance"]
        ),
    },
    xpLedger: {
        indexes: [
            {
                key: { userId: 1, sourceType: 1, sourceId: 1 },
                name: "idx_xpLedger_source",
                unique: true,
            },
        ],
        validator: objectSchema(
            {
                userId: string,
                sourceType: { enum: ["workout", "run", "quest_claim"] },
                sourceId: string,
                amount: { bsonType: "number", minimum: 0 },
                occurredAt: date,
                createdAt: date,
            },
            ["userId", "sourceType", "sourceId", "amount", "occurredAt", "createdAt"]
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
