// APPLICATION SERVICE — orchestrates domain logic + persistence + side effects

import type { CreateWorkoutInput, Workout } from "@/lib/types";
import { insertWorkout, getWorkoutByIdempotencyKey } from "@/lib/data/workout-db";
import { evaluateWorkout } from "@/lib/domain/workout-evaluator";
import { updateQuestProgress } from "@/lib/services/quests/update-quest-progress";
import { UserStateService } from "@/lib/services/users/user-state.service";
import { evaluateAchievements } from "@/lib/services/achievements/evaluate-achievements";
import { clientPromise } from "@/server/platform/database";
import { after } from "next/server";
import { createOnce, type IdempotencyRequest, type IdempotentResult } from "@/server/platform/http";

export async function logWorkout(
    input: CreateWorkoutInput,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<IdempotentResult<Workout>> {
    const result = await createOnce({
        request: idempotency,
        findExisting: () => getWorkoutByIdempotencyKey(userId, idempotency.key),
        create: () => createWorkout(input, userId, idempotency),
        reusedMessage: "This workout was already saved with your earlier details. Check your history to edit it, or submit again to log a new one.",
    });

    if (!result.replayed) {
        // Run achievements evaluation after the response so it never blocks the request
        after(
            evaluateAchievements(userId).catch(err => {
                console.error(`[Background Task] Failed to evaluate achievements for user ${userId}:`, err);
            })
        );
    }

    return result;
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
