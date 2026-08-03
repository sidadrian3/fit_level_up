// APPLICATION SERVICE — orchestrates domain logic + persistence + side effects

import type { CreateWorkoutInput, Workout } from "@/lib/types";
import { insertWorkout, getWorkoutByIdempotencyKey } from "@/lib/data/workout-db";
import { evaluateWorkout } from "@/lib/domain/workout-evaluator";
import { updateQuestProgress } from "@/lib/services/quests/update-quest-progress";
import { UserStateService } from "@/lib/services/users/user-state.service";
import { evaluateAchievements } from "@/lib/services/achievements/evaluate-achievements";
import clientPromise from "@/lib/mongodb";
import { after } from "next/server";
import { ConflictError } from "@/lib/api/errors";

export async function logWorkout(
    input: CreateWorkoutInput,
    userId: string
): Promise<Workout> {

    const client = await clientPromise;
    const session = client.startSession();
    let workoutObj: Workout;
    try {
        workoutObj = await session.withTransaction(async () => {
            const user = await UserStateService.getUser(userId, session);
            
            const evaluation = evaluateWorkout(input, user.stamina);
            // 3. Persistence
            const workout = await insertWorkout({
                userId,
                title: input.title.trim(),
                exercises: evaluation.exercises,
                duration: input.duration,
                xpEarned: evaluation.finalXpEarned,
                date: new Date(),
                idempotencyKey: input.idempotencyKey,
            }, session);

            // 4. Side-effects (explicitly orchestrated, easy to extend or skip)
            await updateQuestProgress(userId, {
                type: "workout_created",
                xpEarned: workout.xpEarned,
            }, session);

            await UserStateService.applyActivity(userId, {
                xpEarned: workout.xpEarned,
                activityDate: new Date(workout.date),
                staminaCost: evaluation.staminaCost,
                stats: { incrementWorkouts: 1 }
            }, session);

            return workout;
        });
    } catch (error: unknown) {
        const err = error as { code?: number; keyPattern?: { idempotencyKey?: number } };
        if (err.code === 11000 && err.keyPattern?.idempotencyKey && input.idempotencyKey) {
            console.log("Duplicate workout request detected. Fetching existing...");
            const existing = await getWorkoutByIdempotencyKey(userId, input.idempotencyKey);
            if (existing) return existing;
            throw new ConflictError("This workout was already logged.");
        }
        throw error;
    } finally {
        await session.endSession();
    }

    // 5. Event-Driven Side Effects (Decoupled from transaction)
    // Run achievements evaluation asynchronously so we don't block the API response
    after(
        evaluateAchievements(userId).catch(err => {
            console.error(`[Background Task] Failed to evaluate achievements for user ${userId}:`, err);
        })
    );

    return workoutObj;
}
