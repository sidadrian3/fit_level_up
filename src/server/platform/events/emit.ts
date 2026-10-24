import type { ClientSession, ObjectId } from "mongodb";
import { getCollection, type OutboxDoc } from "@/server/platform/database";
import type { EventMap, EventType } from "./event-map";
import { recordEmitted } from "./event-scope";

export async function emit<K extends EventType>(
    type: K,
    payload: EventMap[K],
    { session }: { session: ClientSession }
): Promise<ObjectId> {
    const outbox = await getCollection<OutboxDoc<K, EventMap[K]>>("outbox");
    const now = new Date();
    const { insertedId } = await outbox.insertOne(
        {
            type,
            payload,
            status: "pending",
            availableAt: now,
            attempts: 0,
            completedListeners: [],
            lastError: null,
            createdAt: now,
            processedAt: null,
        },
        { session }
    );
    recordEmitted(insertedId);
    return insertedId;
}
