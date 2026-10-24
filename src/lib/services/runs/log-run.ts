import type { CreateRunInput, Run } from "@/lib/types";
import { updateQuestProgress } from "@/server/quests";
import { getUserTimeZone } from "@/server/platform/auth";
import { getPlayerState, recordActivity } from "@/server/progression";
import { insertRun, getRunByIdempotencyKey } from "@/lib/data/runs-db";
import { evaluateRun } from "@/server/training";
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
            const now = new Date();
            const player = await getPlayerState(userId, { now, session });
            const timeZone = await getUserTimeZone(userId, { session });
            const evaluation = evaluateRun(input, player.stamina);

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
            }, { now, timeZone }, session);

            await recordActivity({
                userId,
                source: { type: "run", id: run.id },
                xp: run.xpEarned,
                staminaCost: evaluation.staminaCost,
                totals: { distanceKm: run.distance },
                occurredAt: now,
            }, session);

            return run;
        });
    } finally {
        await session.endSession();
    }
}
