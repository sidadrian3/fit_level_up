import type { CreateRunInput, Run } from "@/lib/types";
import { updateQuestProgress } from "@/lib/services/quests/update-quest-progress";
import { UserStateService } from "@/lib/services/users/user-state.service";
import { evaluateAchievements } from "@/lib/services/achievements/evaluate-achievements";
import { insertRun, getRunByIdempotencyKey } from "@/lib/data/runs-db";
import { evaluateRun } from "@/lib/domain/run-evaluator";
import { clientPromise } from "@/server/platform/database";
import { after } from "next/server";
import { isDuplicateKeyError } from "@/lib/data/mongo-errors";
import { ConflictError } from "@/lib/api/errors";

export async function logRun(
    input: CreateRunInput,
    userId: string
): Promise<Run> {


    const client = await clientPromise;
    const session = client.startSession();
    let runObj: Run;

    try {
        runObj = await session.withTransaction(async () => {
            const user = await UserStateService.getUser(userId, session);
            const now = new Date();
            const evaluation =  evaluateRun(input, user.stamina);

            // 3. Persistence
            const run = await insertRun({
                userId,
                distance: input.distance,
                duration: input.duration,
                pace: evaluation.pace,
                difficulty: input.difficulty,
                xpEarned: evaluation.finalXpEarned,
                date: now,
                idempotencyKey: input.idempotencyKey,
            }, session);

            // 4. Side-effects
            await updateQuestProgress(userId, {
                type: "run_created",
                distance: run.distance,
                xpEarned: run.xpEarned,
            }, { now, timeZone: user.timeZone }, session);

            await UserStateService.applyActivity(userId, {
                xpEarned: run.xpEarned,
                activityAt: now,
                staminaCost: evaluation.staminaCost,
                stats: { incrementDistance: run.distance }
            }, session);

            return run;
        });
    } catch (error: unknown) {
        if (isDuplicateKeyError(error, "idempotencyKey")) {
            console.log("Duplicate run request detected. Fetching existing...");
            const existing = await getRunByIdempotencyKey(userId, input.idempotencyKey);
            if (existing) return existing;
            throw new ConflictError("This run was already logged.");
        }
        throw error;
    } finally {
        await session.endSession();
    }

    // 5. Event-Driven Side Effects (Decoupled from transaction)
    after(
        evaluateAchievements(userId).catch(err => {
            console.error(`[Background Task] Failed to evaluate achievements for user ${userId}:`, err);
        })
    );

    return runObj;
}