import type { ClientSession } from "mongodb";
import type { IdempotentRecord } from "@/server/platform/http";
import { userScopedRepository, type RunDoc, type UserOwnedDoc } from "@/server/platform/database";
import type { Run } from "@/lib/types";
import * as dateQueries from "../date-queries";
import { dateFilter, type DateRange } from "../date-queries";

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
        date: new Date(doc.date).toISOString(),
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

export async function findRunById(userId: string, id: string, session?: ClientSession): Promise<Run | null> {
    const doc = await runs.findById(userId, id, { session });
    return doc ? toRun(doc) : null;
}

export async function updateRunFields(
    userId: string,
    id: string,
    fields: { distance: number; duration: number; pace: number; difficulty: Run["difficulty"]; xpEarned: number },
    session?: ClientSession,
): Promise<Run | null> {
    const doc = await runs.updateById(userId, id, { $set: fields }, { session });
    return doc ? toRun(doc) : null;
}

export function findActivityDaysSince(userId: string, from: Date, timeZone: string, session?: ClientSession): Promise<string[]> {
    return dateQueries.findActivityDaysSince(runs, userId, from, timeZone, session);
}

export function findLatestDate(userId: string, session?: ClientSession): Promise<Date | null> {
    return dateQueries.findLatestDate(runs, userId, session);
}

export function countRuns(userId: string, range: DateRange | null, session?: ClientSession): Promise<number> {
    return runs.count(userId, dateFilter(range), { session });
}

export async function sumRunDistance(userId: string, range: DateRange | null, session?: ClientSession): Promise<number> {
    const [result] = await runs.aggregate<{ totalDistance: number }>(userId, [
        { $match: dateFilter(range) },
        { $group: { _id: null, totalDistance: { $sum: "$distance" } } },
    ], { session });
    return result?.totalDistance ?? 0;
}

export async function deleteRunById(userId: string, id: string, session?: ClientSession): Promise<Run | null> {
    const doc = await runs.deleteById(userId, id, { session });
    return doc ? toRun(doc) : null;
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

export type RunStatTotals = { totalDistance: number; totalPace: number; totalRuns: number };

export async function aggregateRunStats(userId: string): Promise<RunStatTotals | null> {
    const [totals] = await runs.aggregate<RunStatTotals>(userId, [
        { $group: { _id: null, totalDistance: { $sum: "$distance" }, totalPace: { $sum: "$pace" }, totalRuns: { $sum: 1 } } },
        { $project: { _id: 0 } },
    ]);
    return totals ?? null;
}

// Ties resolve to the newest run.
export async function findLongestRun(userId: string): Promise<{ distance: number } | null> {
    const [run] = await runs.find(userId, {}, { limit: 1, sort: { distance: -1, _id: -1 } });
    return run ? { distance: run.distance } : null;
}

export async function findFastestRunInWindow(userId: string, window: { min: number; max: number }): Promise<{ duration: number } | null> {
    const [run] = await runs.find(
        userId,
        { distance: { $gte: window.min, $lte: window.max } },
        { limit: 1, sort: { duration: 1, _id: -1 } },
    );
    return run ? { duration: run.duration } : null;
}
