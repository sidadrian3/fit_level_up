import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId, type ClientSession } from "mongodb";
import { clientPromise, getCollection, type OutboxDoc } from "@/server/platform/database";
import { collectEmittedEvents, createDispatcher, defineListener, emit } from "@/server/platform/events";

declare module "@/server/platform/events" {
    interface EventMap {
        "outbox-test.pinged": { n: number };
        "outbox-test.ponged": { n: number };
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
            }),
        ).rejects.toThrow("abort");

        expect(await (await getCollection<OutboxDoc>("outbox")).countDocuments({})).toBe(0);
    });

    it("records its id in the current event scope", async () => {
        const ids: ObjectId[] = [];

        const emitted = await collectEmittedEvents(ids, () =>
            withTransaction((session) => emit("outbox-test.pinged", { n: 1 }, { session })),
        );
        await withTransaction((session) => emit("outbox-test.pinged", { n: 2 }, { session }));

        expect(ids).toEqual([emitted]);
    });
});

describe("dispatcher", () => {
    const clockAt = (at: Date) => ({ now: () => at });

    async function outbox() {
        return getCollection<OutboxDoc>("outbox");
    }

    async function seedPinged(n = 1): Promise<ObjectId> {
        return withTransaction((session) => emit("outbox-test.pinged", { n }, { session }));
    }

    async function rowOf(id: ObjectId): Promise<OutboxDoc> {
        const row = await (await outbox()).findOne({ _id: id });
        if (!row) throw new Error("row missing");
        return row;
    }

    function pinged(name: string, handle: () => Promise<void> | void = async () => {}) {
        const handler = vi.fn(async () => {
            await handle();
        });
        return {
            handler,
            listener: defineListener({
                name,
                event: "outbox-test.pinged",
                handle: handler,
            }),
        };
    }

    beforeEach(async () => {
        await (await outbox()).deleteMany({});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("delivers an emitted row once and marks it done", async () => {
        const { handler, listener } = pinged("t.ok");
        const dispatcher = createDispatcher([listener]);
        const id = await seedPinged(1);

        await dispatcher.dispatchOwnAndOverdue([id]);

        const row = await rowOf(id);
        expect(handler).toHaveBeenCalledWith({ n: 1 }, { eventId: id, createdAt: row.createdAt });
        expect(row).toMatchObject({
            status: "done",
            attempts: 1,
            completedListeners: ["t.ok"],
        });
        expect(row.processedAt).toBeInstanceOf(Date);

        await dispatcher.dispatchOwnAndOverdue([id]);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("skips an id with no committed row", async () => {
        const { handler, listener } = pinged("t.ok");

        await createDispatcher([listener]).dispatchOwnAndOverdue([new ObjectId()]);

        expect(handler).not.toHaveBeenCalled();
    });

    it("retries only the failing listener", async () => {
        const ok = pinged("t.ok");
        let calls = 0;
        const flaky = pinged("t.flaky", async () => {
            calls += 1;
            if (calls === 1) throw new Error("flaked");
        });
        const listeners = [ok.listener, flaky.listener];
        const id = await seedPinged();
        const rowCreatedAt = (await rowOf(id)).createdAt;
        const firstAttemptAt = new Date(rowCreatedAt.getTime() + 1000);

        await createDispatcher(listeners, clockAt(firstAttemptAt)).dispatchOwnAndOverdue([id]);

        const afterFirst = await rowOf(id);
        expect(afterFirst).toMatchObject({
            status: "pending",
            completedListeners: ["t.ok"],
            lastError: "t.flaky: flaked",
        });
        expect(afterFirst.availableAt).toEqual(new Date(firstAttemptAt.getTime() + 60_000));

        const retryAt = new Date(firstAttemptAt.getTime() + 61_000);
        await createDispatcher(listeners, clockAt(retryAt)).dispatchOwnAndOverdue([id]);

        expect(ok.handler).toHaveBeenCalledTimes(1);
        expect(flaky.handler).toHaveBeenCalledTimes(2);
        expect((await rowOf(id)).status).toBe("done");
    });

    it("backs off exponentially", async () => {
        const { listener } = pinged("t.fail", () => {
            throw new Error("nope");
        });
        const id = await seedPinged();
        await (await outbox()).updateOne({ _id: id }, { $set: { attempts: 3 } });

        const attemptAt = new Date(Date.now() + 1000);

        await createDispatcher([listener], clockAt(attemptAt)).dispatchOwnAndOverdue([id]);

        const row = await rowOf(id);
        expect(row.attempts).toBe(4);
        expect(row.availableAt).toEqual(new Date(attemptAt.getTime() + 480_000));
    });

    it("an expired lease is reclaimable, a live one is not", async () => {
        const { handler, listener } = pinged("t.ok");
        const id = await seedPinged();
        const leaseEnd = new Date(Date.now() + 2 * 60_000);
        await (await outbox()).updateOne({ _id: id }, { $set: { availableAt: leaseEnd, attempts: 1 } });

        expect(await createDispatcher([listener]).drainUntilEmpty()).toMatchObject({
            delivered: 0,
        });
        expect(handler).not.toHaveBeenCalled();

        const later = new Date(Date.now() + 3 * 60_000);
        expect(await createDispatcher([listener], clockAt(later)).drainUntilEmpty()).toMatchObject({ delivered: 1 });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("goes dead after the eighth failed attempt", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const { listener } = pinged("t.fail", async () => {
            throw new Error("boom");
        });
        const id = await seedPinged();
        await (await outbox()).updateOne({ _id: id }, { $set: { attempts: 7 } });

        const summary = await createDispatcher([listener]).drainUntilEmpty();

        expect(summary).toEqual({ delivered: 0, failed: 0, dead: 1 });
        const row = await rowOf(id);
        expect(row).toMatchObject({
            status: "dead",
            attempts: 8,
            lastError: "t.fail: boom",
        });
        expect(row.processedAt).toBeInstanceOf(Date);
        expect(consoleError).toHaveBeenCalled();
    });

    it("two concurrent drains deliver a row once", async () => {
        const { handler, listener } = pinged("t.ok");
        const dispatcher = createDispatcher([listener]);
        await seedPinged();

        const [first, second] = await Promise.all([dispatcher.drainUntilEmpty(), dispatcher.drainUntilEmpty()]);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(first.delivered + second.delivered).toBe(1);
    });

    it("a synchronous throw counts as that listener's failure", async () => {
        const { listener } = pinged("t.sync", () => {
            throw new Error("sync");
        });
        const id = await seedPinged();

        const summary = await createDispatcher([listener]).drainUntilEmpty();

        expect(summary).toEqual({ delivered: 0, failed: 1, dead: 0 });
        expect((await rowOf(id)).lastError).toBe("t.sync: sync");
    });

    it("a non-Error throw becomes a string lastError", async () => {
        const { listener } = pinged("t.fail", () => {
            throw "boom";
        });
        const id = await seedPinged();

        await createDispatcher([listener]).drainUntilEmpty();

        expect((await rowOf(id)).lastError).toBe("t.fail: boom");
    });

    it("joins the errors of several failing listeners", async () => {
        const failing = (name: string) =>
            pinged(name, () => {
                throw new Error("x");
            }).listener;
        const id = await seedPinged();

        await createDispatcher([failing("t.a"), failing("t.b")]).drainUntilEmpty();

        expect((await rowOf(id)).lastError).toBe("t.a: x; t.b: x");
    });

    it("a type with no listeners is marked done", async () => {
        const id = await seedPinged();

        const summary = await createDispatcher([]).drainUntilEmpty();

        expect(summary.delivered).toBe(1);
        expect((await rowOf(id)).status).toBe("done");
    });

    it("dispatchOwnAndOverdue resolves when a listener fails", async () => {
        const { listener } = pinged("t.fail", () => {
            throw new Error("boom");
        });
        const id = await seedPinged();

        await expect(createDispatcher([listener]).dispatchOwnAndOverdue([id])).resolves.toBeUndefined();
    });

    it("also drains up to 3 overdue rows", async () => {
        const { listener } = pinged("t.ok");
        const overdue = [await seedPinged(), await seedPinged(), await seedPinged(), await seedPinged()];
        const ownId = await seedPinged();

        await createDispatcher([listener]).dispatchOwnAndOverdue([ownId]);

        const statuses = await Promise.all([ownId, ...overdue].map(async (id) => (await rowOf(id)).status));
        expect(statuses.filter((status) => status === "done")).toHaveLength(4);
        expect(statuses.filter((status) => status === "pending")).toHaveLength(1);
        expect((await rowOf(ownId)).status).toBe("done");
    });

    it("rejects a duplicate listener name for one event", () => {
        const { listener } = pinged("t.same");
        const other = defineListener({
            name: "t.same",
            event: "outbox-test.ponged",
            handle: async () => {},
        });

        expect(() => createDispatcher([listener, listener])).toThrow("Duplicate listener outbox-test.pinged/t.same");
        expect(() => createDispatcher([listener, other])).not.toThrow();
    });
});
