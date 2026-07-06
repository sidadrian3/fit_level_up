import type { CreateRunInput, Run } from "@/lib/types";
import { updateQuestProgress } from "@/lib/services/quests/update-quest-progress";
import { getUserFromDb, updateUserStatsInDb, updateUserStreakOnActivity, updateUserStaminaInDb } from "@/lib/data/user-db";
import { calcStaminaCost, calcRecoveredStamina, calcExhaustionDebuff } from "@/lib/domain/stamina-rules";
import { grantUserXP } from "@/lib/services/users/grant-user-xp";
import { evaluateAchievements } from "@/lib/services/achievements/evaluate-achievements";
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
    const staminaCost = calcStaminaCost(input.duration);

    try {
        return await session.withTransaction(async () => {
            const user = await getUserFromDb(userId, session);
            const recoveredStamina = calcRecoveredStamina(user.stamina, user.lastStaminaUpdate, new Date());
            
            const finalXpEarned = calcExhaustionDebuff(xpEarned, recoveredStamina, staminaCost);
            const finalStamina = Math.max(0, recoveredStamina - staminaCost);

            // 3. Persistence
            const run = await insertRun({
                userId,
                distance: input.distance,
                duration: input.duration,
                pace,
                difficulty: input.difficulty,
                xpEarned: finalXpEarned,
                date: new Date(),
                idempotencyKey: input.idempotencyKey,
            }, session);

            // 4. Side-effects
            await updateQuestProgress(userId, {
                type: "run_created",
                distance: run.distance,
                xpEarned: run.xpEarned,
            }, session);

            await grantUserXP(userId, run.xpEarned, session);
            await updateUserStatsInDb(userId, { incrementDistance: run.distance }, session);
            await updateUserStreakOnActivity(userId, run.date, session);
            await evaluateAchievements(userId, session);
            await updateUserStaminaInDb(userId, finalStamina, new Date().toISOString(), session);

            return run;
        });
    } catch (error: unknown) {
        const err = error as { code?: number; keyPattern?: { idempotencyKey?: number } };
        if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
            console.log("Duplicate run request ignored safely.");
            throw new Error("This run was already logged.");
        }
        throw error;
    } finally {
        await session.endSession();
    }
}