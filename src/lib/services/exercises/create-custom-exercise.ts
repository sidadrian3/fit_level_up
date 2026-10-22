import { TargetMuscle, CustomExercise } from "@/lib/types";
import { createCustomExerciseFromDb } from "@/lib/data/custom-exercises-db";
import { isDuplicateKeyError } from "@/server/platform/database";
import { formatExerciseName } from "@/lib/domain/exercise-rules";
import { ConflictError } from "@/lib/api/errors";

export async function createCustomExercise(userId: string, rawName: string, targetMuscle: TargetMuscle): Promise<CustomExercise> {
    const name = formatExerciseName(rawName);

    try {
        const doc = await createCustomExerciseFromDb({ userId, name, targetMuscle });
        return {
            id: doc._id!.toString(),
            userId: doc.userId,
            name: doc.name,
            targetMuscle: doc.targetMuscle,
        };
    } catch (error: unknown) {
        if (isDuplicateKeyError(error, "name")) {
            throw new ConflictError("You already created an exercise with this name for this muscle group.");
        }
        throw error;
    }
}
