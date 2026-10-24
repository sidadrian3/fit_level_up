import type { TargetMuscle, CustomExercise } from "@/lib/types";
import { isDuplicateKeyError } from "@/server/platform/database";
import { ConflictError } from "@/server/platform/http";
import { insertCustomExercise } from "./custom-exercise.repository";
import { formatExerciseName } from "./exercise.rules";

export async function createCustomExercise(userId: string, rawName: string, targetMuscle: TargetMuscle): Promise<CustomExercise> {
    const name = formatExerciseName(rawName);

    try {
        return await insertCustomExercise({ userId, name, targetMuscle });
    } catch (error: unknown) {
        if (isDuplicateKeyError(error, "name")) {
            throw new ConflictError("You already created an exercise with this name for this muscle group.");
        }
        throw error;
    }
}
