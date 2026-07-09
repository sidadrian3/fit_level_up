import { ObjectId } from "mongodb";
import type { TargetMuscle, CustomExercise } from "@/lib/types";
import { getCollection } from "@/lib/data/get-collection";
import { ClientSession } from "mongodb";

export interface CustomExerciseDoc {
    _id?: ObjectId;
    userId: string;
    name: string;
    targetMuscle: TargetMuscle;
}

function toCustomExercise(doc: CustomExerciseDoc): CustomExercise {
    if (!doc._id) {
        throw new Error("Custom exercise document is missing _id");
    }
    return {
        id: doc._id.toString(),
        userId: doc.userId,
        name: doc.name,
        targetMuscle: doc.targetMuscle,
    };
}

export async function getAllCustomExercisesFromDb(userId: string): Promise<CustomExercise[]> {
    const collection = await getCollection<CustomExerciseDoc>("customExercisesCollection");

    const docs = await collection.find({ userId }).toArray();
    return docs.map(toCustomExercise);
}

export async function createCustomExerciseFromDb(doc: Omit<CustomExerciseDoc, "_id">, session?: ClientSession): Promise<CustomExerciseDoc> {
    const collection = await getCollection<CustomExerciseDoc>("customExercisesCollection");
    const result = await collection.insertOne(doc, session ? { session } : undefined);
    return { ...doc, _id: result.insertedId };

}

export async function getCustomExerciseByNameFromDb(userId: string, exerciseName: string, muscle: TargetMuscle): Promise<CustomExerciseDoc | null> {
    const collection = await getCollection<CustomExerciseDoc>("customExercisesCollection");
    const doc = await collection.findOne({ userId, name: exerciseName, targetMuscle: muscle });
    return doc;
}