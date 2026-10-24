import type { IdempotentRecord } from "@/server/platform/http";
import {
    MAX_FIND_LIMIT,
    userScopedRepository,
    type UserOwnedDoc,
    type WorkoutTemplateDoc,
} from "@/server/platform/database";
import type { WorkoutTemplate } from "@/lib/types";

type OwnedTemplateDoc = WorkoutTemplateDoc & UserOwnedDoc;

const templates = userScopedRepository<OwnedTemplateDoc>("workoutTemplates");

function toWorkoutTemplate(doc: OwnedTemplateDoc): WorkoutTemplate {
    return {
        id: doc._id.toString(),
        userId: doc.userId,
        name: doc.name,
        exercises: doc.exercises,
        createdAt: doc.createdAt
    };
}

export async function getWorkoutTemplatesFromDb(userId: string): Promise<WorkoutTemplate[]> {
    const docs = await templates.find(userId, {}, { limit: MAX_FIND_LIMIT, sort: { createdAt: -1 } });
    return docs.map(toWorkoutTemplate);
}

export async function getWorkoutTemplateByIdempotencyKeyFromDb(userId: string, idempotencyKey: string): Promise<IdempotentRecord<WorkoutTemplate> | null> {
    const doc = await templates.findOne(userId, { idempotencyKey });
    return doc ? { value: toWorkoutTemplate(doc), fingerprint: doc.idempotencyFingerprint } : null;
}

export async function createWorkoutTemplateInDb(input: Omit<WorkoutTemplateDoc, "_id">): Promise<WorkoutTemplate> {
    const { userId, ...rest } = input;
    return toWorkoutTemplate(await templates.insertOne(userId, rest));
}

export async function deleteWorkoutTemplateFromDb(userId: string, templateId: string): Promise<boolean> {
    return (await templates.deleteById(userId, templateId)) !== null;
}
