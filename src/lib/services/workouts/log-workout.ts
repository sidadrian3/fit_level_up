// APPLICATION SERVICE — orchestrates domain logic + persistence + side effects

import type { CreateWorkoutInput, Workout } from "@/lib/types";
import {
    validateWorkoutInput,
    filterNamedExercises,

    calcWorkoutXP,
} from "@/lib/domain/workout-rules";
import { calcStaminaCost, calcRecoveredStamina, calcExhaustionDebuff } from "@/lib/domain/stamina-rules";
import { insertWorkout } from "@/lib/data/workout-db";
import { updateQuestProgress } from "@/lib/services/quests/update-quest-progress";
import { updateUserStatsInDb, updateUserStreakOnActivity, updateUserStaminaInDb, getUserFromDb } from "@/lib/data/user-db";
import { grantUserXP } from "@/lib/services/users/grant-user-xp";
import { evaluateAchievements } from "@/lib/services/achievements/evaluate-achievements";
import clientPromise from "@/lib/mongodb";

export async function logWorkout(
    input: CreateWorkoutInput,
    userId: string
): Promise<Workout> {
    // 1. Domain validation (pure)
    validateWorkoutInput(input);

    // 2. Domain calculation (pure)
    const exercises = filterNamedExercises(input.exercises);
    const xpEarned = calcWorkoutXP(input.duration, exercises.length);

    const client = await clientPromise;
    const session = client.startSession();
    const staminaCost = calcStaminaCost(input.duration);
    let workoutObj: Workout;
    try {
        workoutObj = await session.withTransaction(async () => {
            const user = await getUserFromDb(userId, session);
            const recoveredStamina = calcRecoveredStamina(user.stamina, user.lastStaminaUpdate, new Date());
            
            const finalXpEarned = calcExhaustionDebuff(xpEarned, recoveredStamina, staminaCost);
            const finalStamina = Math.max(0, recoveredStamina - staminaCost);

            // 3. Persistence
            const workout = await insertWorkout({
                userId,
                title: input.title.trim(),
                exercises,
                duration: input.duration,
                xpEarned: finalXpEarned,
                date: new Date(),
                idempotencyKey: input.idempotencyKey,
            }, session);

            // 4. Side-effects (explicitly orchestrated, easy to extend or skip)
            await updateQuestProgress(userId, {
                type: "workout_created",
                xpEarned: workout.xpEarned,
            }, session);
            await grantUserXP(userId, workout.xpEarned, session);

            await updateUserStatsInDb(userId, { incrementWorkouts: 1 }, session);
            await updateUserStreakOnActivity(userId, workout.date, session);
            await updateUserStaminaInDb(userId, finalStamina, new Date().toISOString(), session);

            return workout;
        });
    } catch (error: unknown) {
        const err = error as { code?: number; keyPattern?: { idempotencyKey?: number } };
        if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
            console.log("Duplicate workout request ignored safely.");
            throw new Error("This workout was already logged.");
        }
        throw error;
    } finally {
        await session.endSession();
    }

    // 5. Event-Driven Side Effects (Decoupled from transaction)
    // Run achievements evaluation asynchronously so we don't block the API response
    evaluateAchievements(userId).catch(err => {
        console.error(`[Background Task] Failed to evaluate achievements for user ${userId}:`, err);
    });

    return workoutObj;
}
