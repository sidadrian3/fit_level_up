import type { CustomExercise } from "@/lib/types";
import { listCustomExercisesForUser } from "./custom-exercise.repository";

export function getCustomExercises(userId: string): Promise<CustomExercise[]> {
    return listCustomExercisesForUser(userId);
}
