import clientPromise from "@/lib/mongodb";
import { getDbConfig } from "@/lib/data/db-config";

let indexesEnsured = false;

export async function ensureIndexes(): Promise<void> {
    if (indexesEnsured) return;

    const config = getDbConfig();
    const client = await clientPromise;
    const db = client.db(config.dbName);

    await Promise.all([
        // Workouts: covers { userId } and { userId, date range } queries
        db.collection(config.workoutsCollection).createIndex(
            { userId: 1, date: -1 },
            { name: "idx_workouts_userId_date" }
        ),

        // Runs: covers { userId } and { userId, date range } queries
        db.collection(config.runsCollection).createIndex(
            { userId: 1, date: -1 },
            { name: "idx_runs_userId_date" }
        ),

        // User Quests: covers the exact-match sync lookup
        db.collection(config.userQuestsCollection).createIndex(
            { userId: 1, questTemplateId: 1, periodStart: 1, periodEnd: 1 },
            { name: "idx_userQuests_sync_lookup" }
        ),

        // User Quests: covers { userId } for getUserQuestsForUserFromDb
        db.collection(config.userQuestsCollection).createIndex(
            { userId: 1 },
            { name: "idx_userQuests_userId" }
        ),

        // Quest Templates: covers { isActive, metric } queries
        db.collection(config.questTemplatesCollection).createIndex(
            { isActive: 1, metric: 1 },
            { name: "idx_questTemplates_active_metric" }
        ),

        // User Achievements: covers { userId } queries
        db.collection(config.userAchievementsCollection).createIndex(
            { userId: 1 },
            { name: "idx_userAchievements_userId" }
        ),

        // Workouts: covers { idempotencyKey } queries
        db.collection(config.workoutsCollection).createIndex(

            { userId: 1, idempotencyKey: 1 },
            {
                name: "idx_workouts_idempotencyKey",
                unique: true,
                partialFilterExpression: { idempotencyKey: { $exists: true } },
            }
        ),

        // Runs: covers { idempotencyKey } queries
        db.collection(config.runsCollection).createIndex(
            { userId: 1, idempotencyKey: 1 },
            {
                name: "idx_runs_idempotencyKey",
                unique: true,
                partialFilterExpression: { idempotencyKey: { $exists: true } },
            }
        ),

        // Custom Exercises: covers { userId } queries
        db.collection(config.customExercisesCollection).createIndex(
            { userId: 1 },
            { name: "idx_customExercises_userId" }
        ),

    ]);

    indexesEnsured = true;
    console.log("Database indexes ensured.");
}
