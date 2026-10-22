import { afterEach, describe, expect, it } from "vitest";
import { applySchema, getDb } from "@/server/platform/database";

const userId = "apply-schema-test-user";

const completeWorkout = {
    userId,
    title: "Push day",
    exercises: [],
    duration: 45,
    xpEarned: 120,
    date: new Date(),
};

describe("applySchema validators", () => {
    afterEach(async () => {
        await (await getDb()).collection("workouts").deleteMany({ userId });
    });

    it("rejects a workout whose date is a string", async () => {
        const workouts = (await getDb()).collection("workouts");

        await expect(
            workouts.insertOne({ ...completeWorkout, date: new Date().toISOString() })
        ).rejects.toMatchObject({ code: 121 });
    });

    it("accepts a complete workout", async () => {
        const workouts = (await getDb()).collection("workouts");

        const result = await workouts.insertOne({ ...completeWorkout });

        expect(result.acknowledged).toBe(true);
    });

    it("is idempotent when applied twice", async () => {
        const db = await getDb();

        await applySchema(db);
        await applySchema(db);

        const [info] = await db.listCollections({ name: "workouts" }, { nameOnly: false }).toArray();
        expect(info.options?.validator).toBeDefined();
    });
});
