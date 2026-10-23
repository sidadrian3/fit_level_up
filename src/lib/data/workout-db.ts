import type { IdempotentRecord } from "@/server/platform/http";
import { ObjectId } from "mongodb";
import type { Exercise, Workout } from "@/lib/types";
import { ClientSession } from "mongodb";
import { getCollection, parseObjectId, type WorkoutDoc } from "@/server/platform/database";
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
    const collection = await getCollection<WorkoutDoc>("workouts");

    let cursor = collection.find({ userId }).sort({ _id: -1 });
    if (skip !== undefined) cursor = cursor.skip(skip);
    if (limit !== undefined) cursor = cursor.limit(limit);

    const docs = await cursor.toArray();
    return docs.map(toWorkout);
}

export async function getPaginatedWorkoutsFromDb(userId: string, limit: number, skip: number) {
    const collection = await getCollection<WorkoutDoc>("workouts");

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
    const collection = await getCollection<WorkoutDoc>("workouts");

    const result = await collection.insertOne(doc, { session });

    return toWorkout({
        _id: result.insertedId,
        idempotencyKey: doc.idempotencyKey,
        ...doc,
    });
}

export async function deleteWorkoutFromDb(id: string, userId: string): Promise<boolean> {
    const _id = parseObjectId(id);
    if (!_id) {
        return false;
    }

    const collection = await getCollection<WorkoutDoc>("workouts");

    const result = await collection.deleteOne({ _id, userId });
    return result.deletedCount === 1;
}

export async function updateWorkoutInDb(
    id: string,
    fields: { title: string; exercises: Exercise[]; duration: number; xpEarned: number },
    userId: string
): Promise<Workout | null> {
    const _id = parseObjectId(id);
    if (!_id) {
        return null;
    }

    const collection = await getCollection<WorkoutDoc>("workouts");

    // Fetch original to preserve date
    const existing = await collection.findOne({ _id, userId });
    if (!existing) {
        return null;
    }

    const updatedDoc = {
        ...fields,
        date: existing.date,  // Keep original date
    };

    const result = await collection.findOneAndUpdate(
        { _id, userId },
        { $set: updatedDoc },
        { returnDocument: "after" }
    );

    if (!result) {
        return null;
    }

    return toWorkout(result);
}

export async function countWorkoutsInRange(userId: string, from: Date, toExclusive: Date): Promise<number> {
    const collection = await getCollection<WorkoutDoc>("workouts");
    return collection.countDocuments({ userId, date: { $gte: from, $lt: toExclusive } });
}

export async function getWorkoutDatesInRange(userId: string, from: Date, toExclusive: Date): Promise<Date[]> {
    const collection = await getCollection<WorkoutDoc>("workouts");
    const docs = await collection
        .find({ userId, date: { $gte: from, $lt: toExclusive } })
        .project<Pick<WorkoutDoc, "date">>({ date: 1 })
        .toArray();
    return docs.map(doc => doc.date);
}

export async function getWorkoutByIdempotencyKey(userId: string, key: string): Promise<IdempotentRecord<Workout> | null> {
    const collection = await getCollection<WorkoutDoc>("workouts");
    const doc = await collection.findOne({ userId, idempotencyKey: key });
    return doc ? { value: toWorkout(doc), fingerprint: doc.idempotencyFingerprint } : null;
}