import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { Exercise, Workout } from "@/lib/types";
import { getDbConfig } from "@/lib/data/db-config";
import { ClientSession } from "mongodb";

type WorkoutDoc = {
    _id?: ObjectId;
    userId: string;
    type: Workout["type"];
    title: string;
    exercises: Exercise[];
    duration: number;
    xpEarned: number;
    date: string;
};



function toWorkout(doc: WorkoutDoc): Workout {
    if (!doc._id) {
        throw new Error("Workout document is missing _id");
    }

    return {
        id: doc._id.toString(),
        type: doc.type,
        title: doc.title,
        exercises: doc.exercises,
        duration: doc.duration,
        xpEarned: doc.xpEarned,
        date: doc.date,
    };
}


export async function getAllWorkoutsFromDb(userId: string): Promise<Workout[]> {
    const { dbName, workoutsCollection: collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<WorkoutDoc>(collectionName);

    const docs = await collection.find({ userId }).sort({ _id: -1 }).toArray();
    return docs.map(toWorkout);
}

export async function insertWorkout(
    doc: Omit<WorkoutDoc, "_id">,
    session?: ClientSession
): Promise<Workout> {
    const { dbName, workoutsCollection: collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<WorkoutDoc>(collectionName);

    const result = await collection.insertOne(doc, { session });

    return toWorkout({
        _id: result.insertedId,
        ...doc,
    });
}

export async function deleteWorkoutFromDb(id: string, userId: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
        return false;
    }

    const { dbName, workoutsCollection: collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<WorkoutDoc>(collectionName);

    const result = await collection.deleteOne({ _id: new ObjectId(id), userId });
    return result.deletedCount === 1;
}

export async function updateWorkoutInDb(
    id: string,
    fields: { type: Workout["type"]; title: string; exercises: Exercise[]; duration: number; xpEarned: number },
    userId: string
): Promise<Workout | null> {
    if (!ObjectId.isValid(id)) {
        return null;
    }

    const { dbName, workoutsCollection: collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<WorkoutDoc>(collectionName);

    // Fetch original to preserve date
    const existing = await collection.findOne({ _id: new ObjectId(id), userId });
    if (!existing) {
        return null;
    }

    const updatedDoc = {
        ...fields,
        date: existing.date,  // Keep original date
    };

    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id), userId },
        { $set: updatedDoc },
        { returnDocument: "after" }
    );

    if (!result) {
        return null;
    }

    return toWorkout(result);
}

export async function countWorkoutsInRange(userId: string, startDate: string, endDate?: string): Promise<number> {
    const { dbName, workoutsCollection } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<WorkoutDoc>(workoutsCollection);

    const dateFilter: any = { $gte: startDate };
    if (endDate) {
        dateFilter.$lte = endDate;
    }

    return collection.countDocuments({
        userId,
        date: dateFilter
    });
}