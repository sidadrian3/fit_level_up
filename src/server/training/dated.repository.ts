import type { ClientSession } from "mongodb";
import type { UserOwnedDoc, UserScopedRepository } from "@/server/platform/database";

export type DateRange = { from: Date; toExclusive: Date };

type DatedRepository = UserScopedRepository<UserOwnedDoc & { date: Date }>;

export const dateFilter = (range: DateRange | null) =>
    range ? { date: { $gte: range.from, $lt: range.toExclusive } } : {};

export async function findActivityDaysSince(
    repository: DatedRepository,
    userId: string,
    from: Date,
    timeZone: string,
    session?: ClientSession,
): Promise<string[]> {
    const rows = await repository.aggregate<{ _id: string }>(userId, [
        { $match: { date: { $gte: from } } },
        { $group: { _id: { $dateToString: { date: "$date", format: "%Y-%m-%d", timezone: timeZone } } } },
    ], { session });
    return rows.map((row) => row._id);
}

export async function findLatestDate(
    repository: DatedRepository,
    userId: string,
    session?: ClientSession,
): Promise<Date | null> {
    const [doc] = await repository.find(userId, {}, { limit: 1, sort: { date: -1 }, projection: { date: 1 }, session });
    return doc ? doc.date : null;
}
