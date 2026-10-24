import type { CreateWorkoutInput, Workout } from "@/lib/types";
import { updateQuestProgress } from "@/server/quests";
import { getUserTimeZone } from "@/server/platform/auth";
import { getPlayerState, recordActivity } from "@/server/progression";
import { clientPromise } from "@/server/platform/database";
import { emit } from "@/server/platform/events";
import { createOnce, type IdempotencyRequest, type IdempotentResult } from "@/server/platform/http";
import { evaluateWorkout } from "./workout.rules";
import { findWorkoutByIdempotencyKey, insertWorkout } from "./workout.repository";

export async function logWorkout(
    input: CreateWorkoutInput,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<IdempotentResult<Workout>> {
    return createOnce({
        request: idempotency,
        findExisting: () => findWorkoutByIdempotencyKey(userId, idempotency.key),
        create: () => createWorkout(input, userId, idempotency),
        reusedMessage: "This workout was already saved with your earlier details. Check your history to edit it, or submit again to log a new one.",
    });
}

async function createWorkout(
    input: CreateWorkoutInput,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<Workout> {
    const client = await clientPromise;
    const session = client.startSession();
    try {
        return await session.withTransaction(async () => {
            const now = new Date();
            const player = await getPlayerState(userId, { now, session });
            const timeZone = await getUserTimeZone(userId, { session });

            const evaluation = evaluateWorkout(input, player.stamina);
            const workout = await insertWorkout({
                userId,
                title: input.title.trim(),
                exercises: evaluation.exercises,
                duration: input.duration,
                xpEarned: evaluation.finalXpEarned,
                date: now,
                idempotencyKey: idempotency.key,
                idempotencyFingerprint: idempotency.fingerprint,
            }, session);
            await emit("activity.logged", { userId, activity: { type: "workout", id: workout.id }, occurredAt: now }, { session });

            await updateQuestProgress(userId, {
                type: "workout_created",
                xpEarned: workout.xpEarned,
            }, { now, timeZone }, session);

            await recordActivity({
                userId,
                source: { type: "workout", id: workout.id },
                xp: workout.xpEarned,
                staminaCost: evaluation.staminaCost,
                totals: { workouts: 1 },
                occurredAt: now,
            }, session);

            return workout;
        });
    } finally {
        await session.endSession();
    }
}
