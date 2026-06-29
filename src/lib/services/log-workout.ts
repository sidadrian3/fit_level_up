// APPLICATION SERVICE — orchestrates domain logic + persistence + side effects

import type { CreateWorkoutInput, Workout } from "@/lib/types";
import {
    validateWorkoutInput,
    filterNamedExercises,
    calcWorkoutXP,
} from "@/lib/domain/workout-rules";
import { insertWorkout } from "@/lib/data/workout-db";
import { updateQuestProgress } from "@/lib/services/update-quest-progress";
import { grantXP, updateUserStats } from "@/lib/data/user-db";
import { evaluateAchievements } from "@/lib/data/achievements-db";

export async function logWorkout(
    input: CreateWorkoutInput,
    userId: string
): Promise<Workout> {
    // 1. Domain validation (pure)
    validateWorkoutInput(input);

    // 2. Domain calculation (pure)
    const exercises = filterNamedExercises(input.exercises);
    const xpEarned = calcWorkoutXP(input.duration, exercises.length);

    // 3. Persistence (single responsibility)
    const workout = await insertWorkout({
        userId,
        type: input.type,
        title: input.title.trim(),
        exercises,
        duration: input.duration,
        xpEarned,
        date: new Date().toISOString().slice(0, 10),
    });

    // 4. Side-effects (explicitly orchestrated, easy to extend or skip)
    await updateQuestProgress(userId, {
        type: "workout_created",
        xpEarned: workout.xpEarned,
    });
    await grantXP(userId, workout.xpEarned);
    await updateUserStats(userId, { incrementWorkouts: 1 });
    await evaluateAchievements(userId);

    return workout;
}
