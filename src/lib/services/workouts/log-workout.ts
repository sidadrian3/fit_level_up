// APPLICATION SERVICE — orchestrates domain logic + persistence + side effects

import type { CreateWorkoutInput, Workout } from "@/lib/types";
import { insertWorkout, getWorkoutByIdempotencyKey } from "@/lib/data/workout-db";
import { evaluateWorkout } from "@/lib/domain/workout-evaluator";
import { updateQuestProgress } from "@/lib/services/quests/update-quest-progress";
import { UserStateService } from "@/lib/services/users/user-state.service";
import { clientPromise } from "@/server/platform/database";
import { emit } from "@/server/platform/events";
import { createOnce, type IdempotencyRequest, type IdempotentResult } from "@/server/platform/http";

export async function logWorkout(
    input: CreateWorkoutInput,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<IdempotentResult<Workout>> {
    return createOnce({
        request: idempotency,
        findExisting: () => getWorkoutByIdempotencyKey(userId, idempotency.key),
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
            const user = await UserStateService.getUser(userId, session);
            const now = new Date();

            const evaluation = evaluateWorkout(input, user.stamina);
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
            }, { now, timeZone: user.timeZone }, session);

            await UserStateService.applyActivity(userId, {
                xpEarned: workout.xpEarned,
                activityAt: now,
                staminaCost: evaluation.staminaCost,
                stats: { incrementWorkouts: 1 }
            }, session);

            return workout;
        });
    } finally {
        await session.endSession();
    }
}
