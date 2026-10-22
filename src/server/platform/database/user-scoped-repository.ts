import type {
    AnyBulkWriteOperation,
    ClientSession,
    Collection,
    Document,
    Filter,
    ObjectId,
    OptionalUnlessRequiredId,
    Sort,
    UpdateFilter,
} from "mongodb";
import { getCollection } from "./get-collection";
import { parseObjectId } from "./mongo-utils";
import type { CollectionKey } from "./schema";

export const MAX_FIND_LIMIT = 200;

export interface UserOwnedDoc {
    _id: ObjectId;
    userId: string;
}

export type ScopedFilter<T extends UserOwnedDoc> = Omit<Filter<T>, "userId" | "_id">;

interface SessionOption {
    session?: ClientSession;
}

interface FindOptions<T> extends SessionOption {
    limit: number;
    sort?: Sort;
    skip?: number;
    projection?: Partial<Record<keyof T, 0 | 1>>;
}

export interface UserScopedRepository<T extends UserOwnedDoc> {
    findById(userId: string, id: string, options?: SessionOption): Promise<T | null>;
    findOne(userId: string, filter: ScopedFilter<T>, options?: SessionOption): Promise<T | null>;
    find(userId: string, filter: ScopedFilter<T>, options: FindOptions<T>): Promise<T[]>;
    paginate(
        userId: string,
        filter: ScopedFilter<T>,
        options: { page: number; limit: number; sort: Sort } & SessionOption,
    ): Promise<{ items: T[]; totalCount: number }>;
    count(userId: string, filter: ScopedFilter<T>, options?: SessionOption): Promise<number>;
    insertOne(userId: string, doc: Omit<T, "_id" | "userId">, options?: SessionOption): Promise<T>;
    updateById(userId: string, id: string, update: UpdateFilter<T>, options?: SessionOption): Promise<T | null>;
    updateOne(
        userId: string,
        filter: ScopedFilter<T>,
        update: UpdateFilter<T>,
        options?: SessionOption & { upsert?: boolean },
    ): Promise<T | null>;
    upsertMany(
        userId: string,
        entries: { filter: ScopedFilter<T>; update: UpdateFilter<T> }[],
        options?: SessionOption,
    ): Promise<void>;
    deleteById(userId: string, id: string, options?: SessionOption): Promise<T | null>;
    aggregate<R extends Document>(userId: string, pipeline: Document[], options?: SessionOption): Promise<R[]>;
}

function assertUpdateKeepsOwner(update: Document): void {
    const touchesOwner = Object.entries(update).some(([key, value]) => {
        if (!key.startsWith("$")) return key === "userId";
        return typeof value === "object" && value !== null && "userId" in value;
    });
    if (touchesOwner) throw new Error("An update must not change userId");
}

function assertValidLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_FIND_LIMIT) {
        throw new Error(`limit must be an integer between 1 and ${MAX_FIND_LIMIT}`);
    }
}

export function userScopedRepository<T extends UserOwnedDoc>(collectionKey: CollectionKey): UserScopedRepository<T> {
    const collection = (): Promise<Collection<T>> => getCollection<T>(collectionKey);
    const owned = (userId: string, filter: object = {}): Filter<T> => ({ ...filter, userId }) as Filter<T>;
    const ownedById = (userId: string, id: string): Filter<T> | null => {
        const _id = parseObjectId(id);
        return _id ? ({ _id, userId } as Filter<T>) : null;
    };

    async function findOne(userId: string, filter: ScopedFilter<T>, options?: SessionOption): Promise<T | null> {
        const col = await collection();
        return (await col.findOne(owned(userId, filter), options)) as T | null;
    }

    async function find(userId: string, filter: ScopedFilter<T>, options: FindOptions<T>): Promise<T[]> {
        assertValidLimit(options.limit);
        const col = await collection();
        return (await col.find(owned(userId, filter), options).toArray()) as T[];
    }

    async function count(userId: string, filter: ScopedFilter<T>, options?: SessionOption): Promise<number> {
        const col = await collection();
        return col.countDocuments(owned(userId, filter), options);
    }

    async function updateOne(
        userId: string,
        filter: ScopedFilter<T>,
        update: UpdateFilter<T>,
        options?: SessionOption & { upsert?: boolean },
    ): Promise<T | null> {
        assertUpdateKeepsOwner(update);
        const col = await collection();
        return (await col.findOneAndUpdate(owned(userId, filter), update, {
            ...options,
            returnDocument: "after",
        })) as T | null;
    }

    return {
        async findById(userId, id, options) {
            const filter = ownedById(userId, id);
            if (!filter) return null;
            const col = await collection();
            return (await col.findOne(filter, options)) as T | null;
        },
        findOne,
        find,
        async paginate(userId, filter, { page, limit, sort, session }) {
            const findPage = () => find(userId, filter, { limit, sort, skip: (page - 1) * limit, session });
            const countAll = () => count(userId, filter, { session });
            if (session) {
                const items = await findPage();
                return { items, totalCount: await countAll() };
            }
            const [items, totalCount] = await Promise.all([findPage(), countAll()]);
            return { items, totalCount };
        },
        count,
        async insertOne(userId, doc, options) {
            const col = await collection();
            const owned = { ...doc, userId } as OptionalUnlessRequiredId<T>;
            const { insertedId } = await col.insertOne(owned, options);
            return { ...doc, userId, _id: insertedId } as unknown as T;
        },
        async updateById(userId, id, update, options) {
            const filter = ownedById(userId, id);
            assertUpdateKeepsOwner(update);
            if (!filter) return null;
            const col = await collection();
            return (await col.findOneAndUpdate(filter, update, { ...options, returnDocument: "after" })) as T | null;
        },
        updateOne,
        async upsertMany(userId, entries, options) {
            if (entries.length === 0) return;
            entries.forEach((entry) => assertUpdateKeepsOwner(entry.update));
            const operations = entries.map(({ filter, update }) => ({
                updateOne: { filter: owned(userId, filter), update, upsert: true },
            })) as AnyBulkWriteOperation<T>[];
            const col = await collection();
            await col.bulkWrite(operations, options);
        },
        async deleteById(userId, id, options) {
            const filter = ownedById(userId, id);
            if (!filter) return null;
            const col = await collection();
            return (await col.findOneAndDelete(filter, options ?? {})) as T | null;
        },
        async aggregate<R extends Document>(userId: string, pipeline: Document[], options?: SessionOption) {
            const col = await collection();
            return col.aggregate<R>([{ $match: { userId } }, ...pipeline], options).toArray();
        },
    };
}
