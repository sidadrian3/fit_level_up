import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { Run } from "@/lib/types";
import { getDbConfig } from "@/lib/data/db-config";
import { ClientSession } from "mongodb";

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
    const { dbName, runsCollection: collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(collectionName);

    const docs = await collection.find({ userId }).sort({ _id: -1 }).toArray();
    return docs.map(toRun);
}

export async function insertRun(
    doc: Omit<RunDoc, "_id">,
    session?: ClientSession
): Promise<Run> {
    const { dbName, runsCollection: collectionName } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(collectionName);

    const result = await collection.insertOne(doc, { session });

    return toRun({
        _id: result.insertedId,
        ...doc,
    });
}

export async function deleteRunFromDb(id: string, userId: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
        return false;
    }
    const { dbName, runsCollection: collectionName } = getDbConfig();
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

    const { dbName, runsCollection: collectionName } = getDbConfig();
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
        { _id: new ObjectId(id), userId },
        { $set: updateDoc },
        { returnDocument: "after" }
    );

    if (!result) {
        return null;
    }

    return toRun(result);
}

export async function getTotalDistanceInRange(userId: string, startDate: string, endDate?: string): Promise<number> {
    const { dbName, runsCollection } = getDbConfig();
    const client = await clientPromise;
    const collection = client.db(dbName).collection<RunDoc>(runsCollection);

    const dateFilter: any = { $gte: startDate };
    if (endDate) {
        dateFilter.$lte = endDate;
    }

    const distanceResult = await collection
        .aggregate([
            {
                $match: {
                    userId,
                    date: dateFilter
                }
            },
            {
                $group: {
                    _id: null,
                    totalDistance: { $sum: "$distance" }
                }
            }
        ]).toArray();

    return distanceResult.length > 0
        ? Math.round(distanceResult[0].totalDistance * 10) / 10
        : 0;
}