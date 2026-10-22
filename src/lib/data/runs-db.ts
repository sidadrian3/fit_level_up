import { ObjectId } from "mongodb";
import type { Run } from "@/lib/types";
import { getCollection, type RunDoc } from "@/server/platform/database";
import { parseObjectId } from "@/lib/data/object-id";
import { ClientSession } from "mongodb";

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
        date: new Date(doc.date).toISOString().slice(0, 10),
    };
}

export async function getAllRunsFromDb(userId: string, limit?: number, skip?: number): Promise<Run[]> {
    const collection = await getCollection<RunDoc>("runs");

    let cursor = collection.find({ userId }).sort({ _id: -1 });
    if (skip !== undefined) cursor = cursor.skip(skip);
    if (limit !== undefined) cursor = cursor.limit(limit);

    const docs = await cursor.toArray();
    return docs.map(toRun);
}

export async function getPaginatedRunsFromDb(userId: string, limit: number, skip: number) {
    const collection = await getCollection<RunDoc>("runs");

    const [docs, totalCount] = await Promise.all([
        collection.find({ userId }).sort({ _id: -1 }).skip(skip).limit(limit).toArray(),
        collection.countDocuments({ userId })
    ]);

    return {
        data: docs.map(toRun),
        totalCount
    };
}

export async function insertRun(
    doc: Omit<RunDoc, "_id">,
    session?: ClientSession
): Promise<Run> {
    const collection = await getCollection<RunDoc>("runs");

    const result = await collection.insertOne(doc, { session });

    return toRun({
        _id: result.insertedId,
        idempotencyKey: doc.idempotencyKey,
        ...doc,
    });
}

export async function deleteRunFromDb(id: string, userId: string): Promise<boolean> {
    const _id = parseObjectId(id);
    if (!_id) {
        return false;
    }
    const collection = await getCollection<RunDoc>("runs");

    const result = await collection.deleteOne({ _id, userId });
    return result.deletedCount === 1;
}

export async function updateRunInDb(
    id: string,
    fields: { distance: number; duration: number; pace: number; difficulty: Run["difficulty"]; xpEarned: number },
    userId: string
): Promise<Run | null> {
    const _id = parseObjectId(id);
    if (!_id) {
        return null;
    }

    const collection = await getCollection<RunDoc>("runs");

    const existing = await collection.findOne({ _id, userId });
    if (!existing) {
        return null;
    }

    const updateDoc = {
        ...fields,
        date: existing.date, // Preserve original date
    };

    const result = await collection.findOneAndUpdate(
        { _id, userId },
        { $set: updateDoc },
        { returnDocument: "after" }
    );

    if (!result) {
        return null;
    }

    return toRun(result);
}

export async function getTotalDistanceInRange(userId: string, from: Date, toExclusive: Date): Promise<number> {
    const collection = await getCollection<RunDoc>("runs");

    const distanceResult = await collection
        .aggregate([
            {
                $match: {
                    userId,
                    date: { $gte: from, $lt: toExclusive }
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

export async function getRunByIdempotencyKey(userId: string, key: string): Promise<Run | null> {
    const collection = await getCollection<RunDoc>("runs");
    const doc = await collection.findOne({ userId, idempotencyKey: key });
    return doc ? toRun(doc) : null;
}