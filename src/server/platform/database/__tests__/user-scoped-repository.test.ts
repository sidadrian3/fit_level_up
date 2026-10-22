import { afterEach, describe, expect, it } from "vitest";
import crypto from "crypto";
import { TargetMuscle } from "@/shared/contracts/exercise";
import {
    clientPromise,
    getCollection,
    MAX_FIND_LIMIT,
    userScopedRepository,
    type UserOwnedDoc,
    type WorkoutTemplateDoc,
} from "..";

type TemplateDoc = WorkoutTemplateDoc & UserOwnedDoc;

const alice = "scoped-repo-alice";
const bob = "scoped-repo-bob";
const repo = userScopedRepository<TemplateDoc>("workoutTemplates");

function templateInput(name: string): Omit<TemplateDoc, "_id" | "userId"> {
    return {
        name,
        exercises: [{ name: "Squat", targetMuscle: TargetMuscle.Legs, sets: 3, reps: 5, weight: 100 }],
        idempotencyKey: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
}

describe("userScopedRepository", () => {
    afterEach(async () => {
        const col = await getCollection<WorkoutTemplateDoc>("workoutTemplates");
        await col.deleteMany({ userId: { $in: [alice, bob] } });
    });

    it("insertOne sets userId and returns the _id", async () => {
        const created = await repo.insertOne(alice, templateInput("Legs"));

        expect(created.userId).toBe(alice);
        expect(created._id).toBeDefined();
        expect(await repo.findById(alice, created._id.toString())).toMatchObject({ name: "Legs" });
    });

    it("propagates a duplicate key error", async () => {
        const input = templateInput("Legs");
        await repo.insertOne(alice, input);

        await expect(repo.insertOne(alice, input)).rejects.toThrow(/11000/);
    });

    it("hides another user's document from every read and write", async () => {
        const theirs = await repo.insertOne(bob, templateInput("Bob's"));
        const id = theirs._id.toString();

        expect(await repo.findById(alice, id)).toBeNull();
        expect(await repo.findOne(alice, { name: "Bob's" })).toBeNull();
        expect(await repo.find(alice, {}, { limit: 10 })).toEqual([]);
        expect(await repo.count(alice, {})).toBe(0);
        expect(await repo.updateById(alice, id, { $set: { name: "Hacked" } })).toBeNull();
        expect(await repo.deleteById(alice, id)).toBeNull();
        expect(await repo.aggregate(alice, [])).toEqual([]);
        expect(await repo.findById(bob, id)).toMatchObject({ name: "Bob's" });
    });

    it("returns null for a malformed id", async () => {
        expect(await repo.findById(alice, "not-an-id")).toBeNull();
        expect(await repo.updateById(alice, "not-an-id", { $set: { name: "x" } })).toBeNull();
        expect(await repo.deleteById(alice, "not-an-id")).toBeNull();
    });

    it("updateById returns the document after the update", async () => {
        const created = await repo.insertOne(alice, templateInput("Old"));

        const updated = await repo.updateById(alice, created._id.toString(), { $set: { name: "New" } });

        expect(updated?.name).toBe("New");
    });

    it("deleteById returns the deleted document", async () => {
        const created = await repo.insertOne(alice, templateInput("Gone"));

        const deleted = await repo.deleteById(alice, created._id.toString());

        expect(deleted?.name).toBe("Gone");
        expect(await repo.count(alice, {})).toBe(0);
    });

    it("updateOne with upsert inserts a document owned by the caller", async () => {
        const input = templateInput("Upserted");

        const result = await repo.updateOne(
            alice,
            { idempotencyKey: input.idempotencyKey },
            { $set: { name: input.name, exercises: input.exercises, createdAt: input.createdAt } },
            { upsert: true },
        );

        expect(result).toMatchObject({ userId: alice, name: "Upserted" });
    });

    it("upsertMany scopes every entry to the caller", async () => {
        const entries = ["a", "b"].map((name) => {
            const input = templateInput(name);
            return {
                filter: { idempotencyKey: input.idempotencyKey },
                update: { $set: { name, exercises: input.exercises, createdAt: input.createdAt } },
            };
        });

        await repo.upsertMany(alice, entries);
        await repo.upsertMany(alice, []);

        expect(await repo.count(alice, {})).toBe(2);
        expect(await repo.count(bob, {})).toBe(0);
    });

    it("paginate returns items and totalCount", async () => {
        for (const name of ["a", "b", "c"]) await repo.insertOne(alice, templateInput(name));

        const page = await repo.paginate(alice, {}, { page: 2, limit: 2, sort: { name: 1 } });

        expect(page.totalCount).toBe(3);
        expect(page.items.map((item) => item.name)).toEqual(["c"]);
    });

    it("paginate works inside a session", async () => {
        await repo.insertOne(alice, templateInput("a"));
        const client = await clientPromise;
        await client.withSession(async (session) => {
            const page = await repo.paginate(alice, {}, { page: 1, limit: 5, sort: { name: 1 }, session });
            expect(page.totalCount).toBe(1);
        });
    });

    it("find rejects a limit above the maximum or below one", async () => {
        await expect(repo.find(alice, {}, { limit: MAX_FIND_LIMIT + 1 })).rejects.toThrow();
        await expect(repo.find(alice, {}, { limit: 0 })).rejects.toThrow();
    });

    it("rejects an update that touches userId", async () => {
        const created = await repo.insertOne(alice, templateInput("Mine"));
        const id = created._id.toString();

        await expect(repo.updateById(alice, id, { $set: { userId: bob } })).rejects.toThrow(/userId/);
        await expect(repo.updateById(alice, id, { $unset: { userId: "" } })).rejects.toThrow(/userId/);
        await expect(
            repo.updateOne(alice, {}, { $setOnInsert: { userId: bob } }, { upsert: true }),
        ).rejects.toThrow(/userId/);
    });
});

