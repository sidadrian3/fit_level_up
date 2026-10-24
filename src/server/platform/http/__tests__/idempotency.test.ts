import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Collection } from "mongodb";
import { getDb } from "@/server/platform/database";
import { createOnce, type IdempotencyRequest } from "../idempotency";
import { IdempotencyKeyReusedError } from "../errors";

interface TestDoc {
    userId: string;
    idempotencyKey?: string;
    idempotencyFingerprint?: string;
    n: number;
}

const userId = "idempotency-test-user";
const request: IdempotencyRequest = { key: "key-1", fingerprint: "fp-1" };
const reusedMessage = "Idempotency key reused with a different request";

let collection: Collection<TestDoc>;

function run(req: IdempotencyRequest, create?: () => Promise<number>) {
    return createOnce<number>({
        request: req,
        reusedMessage,
        findExisting: async () => {
            const doc = await collection.findOne({ userId, idempotencyKey: req.key });
            return doc ? { value: doc.n, fingerprint: doc.idempotencyFingerprint } : null;
        },
        create:
            create ??
            (async () => {
                await collection.insertOne({
                    userId,
                    idempotencyKey: req.key,
                    idempotencyFingerprint: req.fingerprint,
                    n: 1,
                });
                return 1;
            }),
    });
}

describe("createOnce", () => {
    beforeAll(async () => {
        const db = await getDb();
        collection = db.collection<TestDoc>("idempotency_test");
        await collection.createIndex(
            { userId: 1, idempotencyKey: 1 },
            { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true } } }
        );
    });

    beforeEach(async () => {
        await collection.deleteMany({ userId });
    });

    afterAll(async () => {
        await collection.drop();
    });

    it("creates when the key is new", async () => {
        await expect(run(request)).resolves.toEqual({ value: 1, replayed: false });
        expect(await collection.countDocuments({ userId })).toBe(1);
    });

    it("replays when the key and fingerprint match", async () => {
        await run(request);
        const create = vi.fn(async () => 2);

        await expect(run(request, create)).resolves.toEqual({ value: 1, replayed: true });
        expect(create).not.toHaveBeenCalled();
    });

    it("throws IdempotencyKeyReusedError when the fingerprint differs", async () => {
        await run(request);

        const error = await run({ key: request.key, fingerprint: "other" }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(IdempotencyKeyReusedError);
        expect(error).toMatchObject({ statusCode: 422, message: reusedMessage });
    });

    it("throws when the stored document has no fingerprint", async () => {
        await collection.insertOne({ userId, idempotencyKey: request.key, n: 1 });

        await expect(run(request)).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
    });

    it("resolves two racing calls to one document", async () => {
        const results = await Promise.all([run(request), run(request)]);

        expect(results.filter((r) => r.replayed)).toHaveLength(1);
        expect(results.filter((r) => !r.replayed)).toHaveLength(1);
        expect(await collection.countDocuments({ userId })).toBe(1);
    });

    it("rethrows a non-duplicate error from create", async () => {
        await expect(
            run(request, async () => {
                throw new Error("boom");
            })
        ).rejects.toThrow("boom");
    });
});
