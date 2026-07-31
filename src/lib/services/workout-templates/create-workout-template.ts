import { WorkoutTemplateSchema } from "@/lib/validations/schemas";
import { createWorkoutTemplateInDb } from "@/lib/data/workout-templates-db";
import { z } from "zod";
import type { WorkoutTemplate } from "@/lib/types";

export async function createWorkoutTemplate(
    input: z.infer<typeof WorkoutTemplateSchema>,
    userId: string
): Promise<WorkoutTemplate>{
    const template = await createWorkoutTemplateInDb({
        userId,
        name: input.name,
        exercises: input.exercises,
        idempotencyKey: input.idempotencyKey,
        createdAt: new Date().toISOString(),
    });
    return template;
}