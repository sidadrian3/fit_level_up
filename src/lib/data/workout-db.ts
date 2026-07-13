import { ObjectId } from "mongodb";
import type { Exercise, Workout } from "@/lib/types";
import { ClientSession } from "mongodb";
import { getCollection } from "@/lib/data/get-collection";
type WorkoutDoc = {
    _id?: ObjectId;
    userId: string;
    title: string;
    exercises: Exercise[];
    duration: number;
    xpEarned: number;
    date: Date;
    idempotencyKey?: string;
};



function toWorkout(doc: WorkoutDoc): Workout {
    if (!doc._id) {
        throw new Error("Workout document is missing _id");
    }

    return {
        id: doc._id.toString(),
        title: doc.title,
        exercises: doc.exercises,
        duration: doc.duration,
        xpEarned: doc.xpEarned,
        date: new Date(doc.date).toISOString().slice(0, 10),
    };
}


export async function getAllWorkoutsFromDb(userId: string, limit?: number, skip?: number): Promise<Workout[]> {
    const collection = await getCollection<WorkoutDoc>("workoutsCollection");

    let cursor = collection.find({ userId }).sort({ _id: -1 });
    if (skip !== undefined) cursor = cursor.skip(skip);
    if (limit !== undefined) cursor = cursor.limit(limit);

    const docs = await cursor.toArray();
    return docs.map(toWorkout);
}

export async function getPaginatedWorkoutsFromDb(userId: string, limit: number, skip: number) {
    const collection = await getCollection<WorkoutDoc>("workoutsCollection");

    const [docs, totalCount] = await Promise.all([
        collection.find({ userId }).sort({ _id: -1 }).skip(skip).limit(limit).toArray(),
        collection.countDocuments({ userId })
    ]);

    return {
        data: docs.map(toWorkout),
        totalCount
    };
}

export async function insertWorkout(
    doc: Omit<WorkoutDoc, "_id">,
    session?: ClientSession
): Promise<Workout> {
    const collection = await getCollection<WorkoutDoc>("workoutsCollection");

    const result = await collection.insertOne(doc, { session });

    return toWorkout({
        _id: result.insertedId,
        idempotencyKey: doc.idempotencyKey,
        ...doc,
    });
}

export async function deleteWorkoutFromDb(id: string, userId: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
        return false;
    }

    const collection = await getCollection<WorkoutDoc>("workoutsCollection");

    const result = await collection.deleteOne({ _id: new ObjectId(id), userId });
    return result.deletedCount === 1;
}

export async function updateWorkoutInDb(
    id: string,
    fields: { title: string; exercises: Exercise[]; duration: number; xpEarned: number },
    userId: string
): Promise<Workout | null> {
    if (!ObjectId.isValid(id)) {
        return null;
    }

    const collection = await getCollection<WorkoutDoc>("workoutsCollection");

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
    const collection = await getCollection<WorkoutDoc>("workoutsCollection");

    const dateFilter: Record<string, Date> = { $gte: new Date(startDate) };
    if (endDate) {
        dateFilter.$lte = new Date(endDate);
    }

    return collection.countDocuments({
        userId,
        date: dateFilter
    });
}