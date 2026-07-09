import { TargetMuscle, CustomExercise } from "@/lib/types";
import { getCustomExerciseByNameFromDb, createCustomExerciseFromDb } from "@/lib/data/custom-exercises-db";
import { formatExerciseName } from "@/lib/domain/exercise-rules";

export async function createCustomExercise(userId: string, rawName: string, targetMuscle: TargetMuscle): Promise<CustomExercise> {
    const name = formatExerciseName(rawName);

    // 1. Domain Validation: Check for duplicates
    const existing = await getCustomExerciseByNameFromDb(userId, name, targetMuscle);
    if (existing) {
        throw new Error("You already created an exercise with this name for this muscle group.");
    }

    // 2. Persistence
    const doc = await createCustomExerciseFromDb({
        userId,
        name,
        targetMuscle
    });

    // 3. Map back to domain model
    return {
        id: doc._id!.toString(),
        userId: doc.userId,
        name: doc.name,
        targetMuscle: doc.targetMuscle,
    };
}
