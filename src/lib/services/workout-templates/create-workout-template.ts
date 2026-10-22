import { WorkoutTemplateSchema } from "@/shared/contracts/template";
import { createWorkoutTemplateInDb, getWorkoutTemplateByIdempotencyKeyFromDb } from "@/lib/data/workout-templates-db";
import { isDuplicateKeyError } from "@/lib/data/mongo-errors";
import { ConflictError } from "@/lib/api/errors";
import { z } from "zod";
import type { WorkoutTemplate } from "@/lib/types";

export async function createWorkoutTemplate(
    input: z.infer<typeof WorkoutTemplateSchema>,
    userId: string
): Promise<WorkoutTemplate>{
    try {
        return await createWorkoutTemplateInDb({
            userId,
            name: input.name,
            exercises: input.exercises,
            idempotencyKey: input.idempotencyKey,
            createdAt: new Date().toISOString(),
        });
    } catch (error: unknown) {
        if (!isDuplicateKeyError(error, "idempotencyKey")) throw error;

        const existing = await getWorkoutTemplateByIdempotencyKeyFromDb(userId, input.idempotencyKey);
        if (existing) return existing;
        throw new ConflictError("This template was already created.");
    }
}
