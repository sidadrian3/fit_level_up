import { ObjectId } from "mongodb";
import { getCollection, type WorkoutTemplateDoc } from "@/server/platform/database";
import { parseObjectId } from "@/lib/data/object-id";
import type { WorkoutTemplate, Exercise } from "@/lib/types";

function toWorkoutTemplate(doc: WorkoutTemplateDoc): WorkoutTemplate {
    return {
        id: doc._id!.toString(),
        userId: doc.userId,
        name: doc.name,
        exercises: doc.exercises,
        createdAt: doc.createdAt
    };
}

export async function getWorkoutTemplatesFromDb(userId: string): Promise<WorkoutTemplate[]> {
    const collection = await getCollection<WorkoutTemplateDoc>("workoutTemplates");
    const docs = await collection.find({ userId }).sort({ createdAt: -1 }).toArray();

    return docs.map(toWorkoutTemplate);
}

export async function getWorkoutTemplateByIdempotencyKeyFromDb(userId: string, idempotencyKey: string): Promise<WorkoutTemplate | null> {
    const collection = await getCollection<WorkoutTemplateDoc>("workoutTemplates");
    const doc = await collection.findOne({ userId, idempotencyKey });
    return doc ? toWorkoutTemplate(doc) : null;
}

export async function createWorkoutTemplateInDb(input: Omit<WorkoutTemplateDoc, "_id">): Promise<WorkoutTemplate> {
    const collection = await getCollection<WorkoutTemplateDoc>("workoutTemplates");
    const result = await collection.insertOne({ ...input });
    return toWorkoutTemplate({ ...input, _id: result.insertedId });
}

export async function deleteWorkoutTemplateFromDb(userId: string, templateId: string): Promise<boolean> {
    const _id = parseObjectId(templateId);
    if (!_id) return false;
    const collection = await getCollection<WorkoutTemplateDoc>("workoutTemplates");
    const result = await collection.deleteOne({ _id, userId });
    return result.deletedCount === 1;
}
