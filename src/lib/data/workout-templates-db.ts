import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/data/get-collection";
import type { WorkoutTemplate, Exercise } from "@/lib/types";

export interface WorkoutTemplateMongoDoc {
    _id?: ObjectId;
    userId: string;
    name: string;
    exercises: Exercise[];
    idempotencyKey: string;
    createdAt: string;
}

export async function getWorkoutTemplatesFromDb(userId: string): Promise<WorkoutTemplate[]> {
    const collection = await getCollection<WorkoutTemplateMongoDoc>("workoutTemplatesCollection");
    const docs = await collection.find({ userId }).sort({ createdAt: -1 }).toArray();
    
    return docs.map(doc => ({
        id: doc._id!.toString(),
        userId: doc.userId,
        name: doc.name,
        exercises: doc.exercises,
        createdAt: doc.createdAt
    }));
}

export async function createWorkoutTemplateInDb(input: Omit<WorkoutTemplateMongoDoc, "_id">): Promise<WorkoutTemplate> {
    const collection = await getCollection<WorkoutTemplateMongoDoc>("workoutTemplatesCollection");
    
    // Idempotency check: if a template with this idempotency key already exists for the user, return it
    const existing = await collection.findOne({ userId: input.userId, idempotencyKey: input.idempotencyKey });
    if (existing) {
        return {
            id: existing._id!.toString(),
            userId: existing.userId,
            name: existing.name,
            exercises: existing.exercises,
            createdAt: existing.createdAt
        };
    }

    const result = await collection.insertOne(input);
    return {
        id: result.insertedId.toString(),
        userId: input.userId,
        name: input.name,
        exercises: input.exercises,
        createdAt: input.createdAt
    };
}

export async function deleteWorkoutTemplateFromDb(userId: string, templateId: string): Promise<boolean> {
    const collection = await getCollection<WorkoutTemplateMongoDoc>("workoutTemplatesCollection");
    const result = await collection.deleteOne({ _id: new ObjectId(templateId), userId });
    return result.deletedCount === 1;
}
