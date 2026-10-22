import type { Collection, Db, Document } from "mongodb";
import { env } from "@/server/platform/env";
import { clientPromise } from "./client";
import { COLLECTIONS, type CollectionKey } from "./schema";

export async function getDb(): Promise<Db> {
    const client = await clientPromise;
    return client.db(env.MONGODB_DB);
}

export async function collectionExists(db: Db, name: string): Promise<boolean> {
    return (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
}

export async function getCollection<T extends Document>(key: CollectionKey): Promise<Collection<T>> {
    const db = await getDb();
    return db.collection<T>(COLLECTIONS[key]);
}
