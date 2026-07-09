import type { CreateWorkoutInput, Workout } from "@/lib/types";
import { updateWorkoutInDb } from "@/lib/data/workout-db";
import {
    validateWorkoutInput,
    filterNamedExercises,
    calcWorkoutXP,
} from "@/lib/domain/workout-rules";

export async function updateWorkout(
    id: string,
    input: CreateWorkoutInput,
    userId: string
): Promise<Workout | null> {
    // 1. Domain validation (pure)
    validateWorkoutInput(input);

    // 2. Domain calculation (pure)
    const exercises = filterNamedExercises(input.exercises);
    const xpEarned = calcWorkoutXP(input.duration, exercises.length);

    // 3. Persistence — pass pre-built fields, DB just writes
    return updateWorkoutInDb(id, {
        title: input.title.trim(),
        exercises,
        duration: input.duration,
        xpEarned,
    }, userId);
}