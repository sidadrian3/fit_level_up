import type { CustomExercise, TargetMuscle } from "@/shared/contracts/exercise";
import { isDuplicateKeyError } from "@/server/platform/database";
import { ConflictError } from "@/server/platform/http";
import { insertCustomExercise, listCustomExercisesForUser } from "./custom-exercise.repository";

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

export function getCustomExercises(userId: string): Promise<CustomExercise[]> {
    return listCustomExercisesForUser(userId);
}

function formatExerciseName(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
