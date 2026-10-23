import { WorkoutTemplateSchema } from "@/shared/contracts/template";
import { createWorkoutTemplateInDb, getWorkoutTemplateByIdempotencyKeyFromDb } from "@/lib/data/workout-templates-db";
import { createOnce, type IdempotencyRequest, type IdempotentResult } from "@/server/platform/http";
import { z } from "zod";
import type { WorkoutTemplate } from "@/lib/types";

export function createWorkoutTemplate(
    input: z.infer<typeof WorkoutTemplateSchema>,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<IdempotentResult<WorkoutTemplate>> {
    return createOnce({
        request: idempotency,
        findExisting: () => getWorkoutTemplateByIdempotencyKeyFromDb(userId, idempotency.key),
        create: () => createWorkoutTemplateInDb({
            userId,
            name: input.name,
            exercises: input.exercises,
            idempotencyKey: idempotency.key,
            idempotencyFingerprint: idempotency.fingerprint,
            createdAt: new Date().toISOString(),
        }),
        reusedMessage: "This template was already saved with your earlier details. Submit again to save a new one.",
    });
}
