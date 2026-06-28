import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { Run } from "@/lib/types";

type RunDoc = {
    _id?: ObjectId;
    userId: string;
    distance: number;
    duration: number;
    pace: number;
    difficulty: Run["difficulty"];
    xpEarned: number;
    date: string;
}

function getDbConfig() {
    const dbName = process.env.MONGODB_DB;
    const collectionName = process.env.MONGODB_RUNS_COLLECTION;

    if (!dbName) {
        throw new Error("Missing MONGODB_DB in .env.local");
    }
    if (!collectionName) {
        throw new Error("Missing MONGODB_RUNS_COLLECTION in .env.local");
    }

    return { dbName, collectionName };
}

function toRun(doc: RunDoc): Run {
    if (!doc._id) {
        throw new Error("Run document is missing _id");
    }
    return {
        id: doc._id.toString(),
        distance: doc.distance,
        duration: doc.duration,
        pace: doc.pace,
        difficulty: doc.difficulty,
        xpEarned: doc.xpEarned,
        date: doc.date
    };
}

export async function getAllRunsFromDb(userId: string): Promise<Run[]> {
    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(collectionName);

    const docs = await collection.find({ userId }).sort({ _id: -1 }).toArray();
    return docs.map(toRun);
}

export async function insertRun(
    doc: Omit<RunDoc, "_id">
): Promise<Run> {
    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(collectionName);

    const result = await collection.insertOne(doc);

    return toRun({
        _id: result.insertedId,
        ...doc,
    });
}

export async function deleteRunFromDb(id: string, userId: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
        return false;
    }
    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(collectionName);

    const result = await collection.deleteOne({ _id: new ObjectId(id), userId });
    return result.deletedCount === 1;
}

export async function updateRunInDb(
    id: string,
    fields: { distance: number; duration: number; pace: number; difficulty: Run["difficulty"]; xpEarned: number },
    userId: string
): Promise<Run | null> {
    if (!ObjectId.isValid(id)) {
        return null;
    }

    const { dbName, collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(collectionName);

    const existing = await collection.findOne({ _id: new ObjectId(id), userId });
    if (!existing) {
        return null;
    }

    const updateDoc = {
        ...fields,
        date: existing.date, // Preserve original date
    };

    const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateDoc },
        { returnDocument: "after" }
    );

    if (!result) {
        return null;
    }

    return toRun(result);
}