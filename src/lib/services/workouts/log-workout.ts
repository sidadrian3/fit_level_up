// APPLICATION SERVICE — orchestrates domain logic + persistence + side effects

import type { CreateWorkoutInput, Workout } from "@/lib/types";
import {
    validateWorkoutInput,
    filterNamedExercises,

    calcWorkoutXP,
} from "@/lib/domain/workout-rules";
import { insertWorkout } from "@/lib/data/workout-db";
import { updateQuestProgress } from "@/lib/services/quests/update-quest-progress";
import { updateUserStatsInDb, updateUserStreakOnActivity } from "@/lib/data/user-db";
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

    try {
        return await session.withTransaction(async () => {
            // 3. Persistence
            const workout = await insertWorkout({
                userId,
                type: input.type,
                title: input.title.trim(),
                exercises,
                duration: input.duration,
                xpEarned,
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
            await evaluateAchievements(userId, session);

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
}
