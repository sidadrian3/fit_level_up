import { CustomExercise } from "@/lib/types";
import { getAllCustomExercisesFromDb } from "@/lib/data/custom-exercises-db";

export async function getCustomExercises(userId: string): Promise<CustomExercise[]> {
    return getAllCustomExercisesFromDb(userId);
}
