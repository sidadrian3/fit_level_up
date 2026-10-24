import type { CreateRunInput, Run } from "@/lib/types";
import { updateQuestProgress } from "@/lib/services/quests/update-quest-progress";
import { UserStateService } from "@/lib/services/users/user-state.service";
import { insertRun, getRunByIdempotencyKey } from "@/lib/data/runs-db";
import { evaluateRun } from "@/lib/domain/run-evaluator";
import { clientPromise } from "@/server/platform/database";
import { emit } from "@/server/platform/events";
import { createOnce, type IdempotencyRequest, type IdempotentResult } from "@/server/platform/http";

export async function logRun(
    input: CreateRunInput,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<IdempotentResult<Run>> {
    return createOnce({
        request: idempotency,
        findExisting: () => getRunByIdempotencyKey(userId, idempotency.key),
        create: () => createRun(input, userId, idempotency),
        reusedMessage: "This run was already saved with your earlier details. Check your history to edit it, or submit again to log a new one.",
    });
}

async function createRun(
    input: CreateRunInput,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<Run> {
    const client = await clientPromise;
    const session = client.startSession();
    try {
        return await session.withTransaction(async () => {
            const user = await UserStateService.getUser(userId, session);
            const now = new Date();
            const evaluation = evaluateRun(input, user.stamina);

            const run = await insertRun({
                userId,
                distance: input.distance,
                duration: input.duration,
                pace: evaluation.pace,
                difficulty: input.difficulty,
                xpEarned: evaluation.finalXpEarned,
                date: now,
                idempotencyKey: idempotency.key,
                idempotencyFingerprint: idempotency.fingerprint,
            }, session);
            await emit("activity.logged", { userId, activity: { type: "run", id: run.id }, occurredAt: now }, { session });

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
    } finally {
        await session.endSession();
    }
}
