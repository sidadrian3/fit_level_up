import clientPromise from "@/lib/mongodb";
import { getDbConfig } from "@/lib/data/db-config";
import type { Document } from "mongodb";

type CollectionName = keyof ReturnType<typeof getDbConfig>;

/**
 * Returns a typed MongoDB collection handle.
 * Replaces the 3-line boilerplate that every DB function currently repeats.
 *
 * Usage:
 *   const collection = await getCollection<WorkoutDoc>("workoutsCollection");
 */
export async function getCollection<T extends Document>(
    collectionKey: CollectionName
) {
    const config = getDbConfig();
    const name = config[collectionKey];
    if (typeof name !== "string") {
        throw new Error(`Invalid collection key: ${String(collectionKey)}`);
    }
    const client = await clientPromise;
    return client.db(config.dbName).collection<T>(name);
}
