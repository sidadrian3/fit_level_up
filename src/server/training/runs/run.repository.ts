import type { ClientSession } from "mongodb";
import type { IdempotentRecord } from "@/server/platform/http";
import { userScopedRepository, type RunDoc, type UserOwnedDoc } from "@/server/platform/database";
import type { Run } from "@/lib/types";

type OwnedRunDoc = RunDoc & UserOwnedDoc;

const runs = userScopedRepository<OwnedRunDoc>("runs");

function toRun(doc: OwnedRunDoc): Run {
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

export async function listRunsPage(userId: string, page: number, limit: number): Promise<{ data: Run[]; totalCount: number }> {
    const { items, totalCount } = await runs.paginate(userId, {}, { page, limit, sort: { _id: -1 } });
    return { data: items.map(toRun), totalCount };
}

export async function insertRun(input: Omit<RunDoc, "_id">, session?: ClientSession): Promise<Run> {
    const { userId, ...rest } = input;
    return toRun(await runs.insertOne(userId, rest, { session }));
}

export async function updateRunFields(
    userId: string,
    id: string,
    fields: { distance: number; duration: number; pace: number; difficulty: Run["difficulty"]; xpEarned: number },
): Promise<Run | null> {
    const doc = await runs.updateById(userId, id, { $set: fields });
    return doc ? toRun(doc) : null;
}

export async function deleteRunById(userId: string, id: string): Promise<boolean> {
    return (await runs.deleteById(userId, id)) !== null;
}

export async function sumDistanceInRange(userId: string, from: Date, toExclusive: Date): Promise<number> {
    const [result] = await runs.aggregate<{ totalDistance: number }>(userId, [
        { $match: { date: { $gte: from, $lt: toExclusive } } },
        { $group: { _id: null, totalDistance: { $sum: "$distance" } } },
    ]);
    return result ? Math.round(result.totalDistance * 10) / 10 : 0;
}

export async function findRunByIdempotencyKey(userId: string, idempotencyKey: string): Promise<IdempotentRecord<Run> | null> {
    const doc = await runs.findOne(userId, { idempotencyKey });
    return doc ? { value: toRun(doc), fingerprint: doc.idempotencyFingerprint } : null;
}
