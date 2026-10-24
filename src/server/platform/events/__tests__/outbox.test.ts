import { beforeEach, describe, expect, it } from "vitest";
import type { ClientSession, ObjectId } from "mongodb";
import { clientPromise, getCollection, type OutboxDoc } from "@/server/platform/database";
import { collectEmittedEvents, emit } from "@/server/platform/events";

declare module "@/server/platform/events" {
    interface EventMap {
        "outbox-test.pinged": { n: number };
    }
}

async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = (await clientPromise).startSession();
    try {
        return await session.withTransaction(() => work(session));
    } finally {
        await session.endSession();
    }
}

describe("emit", () => {
    beforeEach(async () => {
        await (await getCollection<OutboxDoc>("outbox")).deleteMany({});
    });

    it("in a committed transaction writes one pending row", async () => {
        await withTransaction((session) => emit("outbox-test.pinged", { n: 1 }, { session }));

        const rows = await (await getCollection<OutboxDoc>("outbox")).find({}).toArray();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            type: "outbox-test.pinged",
            payload: { n: 1 },
            status: "pending",
            attempts: 0,
            completedListeners: [],
            lastError: null,
            processedAt: null,
        });
        expect(rows[0].availableAt).toEqual(rows[0].createdAt);
    });

    it("in an aborted transaction leaves no row", async () => {
        await expect(
            withTransaction(async (session) => {
                await emit("outbox-test.pinged", { n: 1 }, { session });
                throw new Error("abort");
            })
        ).rejects.toThrow("abort");

        expect(await (await getCollection<OutboxDoc>("outbox")).countDocuments({})).toBe(0);
    });

    it("records its id in the current event scope", async () => {
        const ids: ObjectId[] = [];

        const emitted = await collectEmittedEvents(ids, () =>
            withTransaction((session) => emit("outbox-test.pinged", { n: 1 }, { session }))
        );
        await withTransaction((session) => emit("outbox-test.pinged", { n: 2 }, { session }));

        expect(ids).toEqual([emitted]);
    });
});
