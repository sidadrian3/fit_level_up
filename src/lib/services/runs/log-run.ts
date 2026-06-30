import type { CreateRunInput, Run } from "@/lib/types";
import { updateQuestProgress } from "@/lib/services/quests/update-quest-progress";
import { updateUserStatsInDb } from "@/lib/data/user-db";
import { grantUserXP } from "@/lib/services/users/grant-user-xp";
import { evaluateAchievements } from "@/lib/data/achievements-db";
import { insertRun } from "@/lib/data/runs-db";
import clientPromise from "@/lib/mongodb";
import {
    validateRunInput,
    calcRunXP,
    calcPace,
} from "@/lib/domain/run-rules";

export async function logRun(
    input: CreateRunInput,
    userId: string
): Promise<Run> {

    // 1. Domain validation (pure)
    validateRunInput(input);

    // 2. Domain calculation (pure)
    const xpEarned = calcRunXP(input.distance, input.duration, input.difficulty);
    const pace = calcPace(input.distance, input.duration);

    const client = await clientPromise;
    const session = client.startSession();

    try {
        return await session.withTransaction(async () => {
            // 3. Persistence
            const run = await insertRun({
                userId,
                distance: input.distance,
                duration: input.duration,
                pace,
                difficulty: input.difficulty,
                xpEarned,
                date: new Date().toISOString().slice(0, 10),
            }, session);

            // 4. Side-effects
            await updateQuestProgress(userId, {
                type: "run_created",
                distance: run.distance,
                xpEarned: run.xpEarned,
            }, session);
            
            await grantUserXP(userId, run.xpEarned, session);
            await updateUserStatsInDb(userId, { incrementDistance: run.distance }, session);
            await evaluateAchievements(userId, session);

            return run;
        });
    } finally {
        await session.endSession();
    }
}