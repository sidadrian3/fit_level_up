import type { CreateWorkoutInput, Workout } from "@/lib/types";
import { calcWorkoutXP, filterNamedExercises, validateWorkoutInput } from "./workout.rules";
import { updateWorkoutFields } from "./workout.repository";

export async function updateWorkout(id: string, input: CreateWorkoutInput, userId: string): Promise<Workout | null> {
    validateWorkoutInput(input);

    const exercises = filterNamedExercises(input.exercises);
    const xpEarned = calcWorkoutXP(input.duration, exercises.length);

    return updateWorkoutFields(userId, id, {
        title: input.title.trim(),
        exercises,
        duration: input.duration,
        xpEarned,
    });
}
