import { describe, it, expect, beforeAll, afterEach } from "vitest";
import crypto from "crypto";
import { createWorkoutTemplate } from "../workout-templates/create-workout-template";
import { getCollection } from "@/server/platform/database";
import { TargetMuscle } from "@/lib/types";

const userId = "template-service-user";

function buildInput(idempotencyKey: string = crypto.randomUUID()) {
    return {
        name: "Upper Body Power",
        idempotencyKey,
        exercises: [
            { name: "Bench Press", targetMuscle: TargetMuscle.Chest, sets: 3, reps: 5, weight: 225 }
        ],
    };
}

describe("createWorkoutTemplate Integration Test", () => {
    beforeAll(async () => {
    });

    afterEach(async () => {
        await (await getCollection("workoutTemplates")).deleteMany({ userId });
    });

    it("persists the template with a generated createdAt", async () => {
        const template = await createWorkoutTemplate(buildInput(), userId);

        expect(template.id).toBeDefined();
        expect(template.userId).toBe(userId);
        expect(template.name).toBe("Upper Body Power");
        expect(Number.isNaN(Date.parse(template.createdAt))).toBe(false);
    });

    it("returns the existing template when the same idempotency key is retried", async () => {
        const input = buildInput();

        const first = await createWorkoutTemplate(input, userId);
        const retry = await createWorkoutTemplate(input, userId);

        expect(retry.id).toBe(first.id);
        expect(await (await getCollection("workoutTemplates")).countDocuments({ userId })).toBe(1);
    });

    it("resolves racing retries to one row without an error", async () => {
        const input = buildInput();

        const [a, b] = await Promise.all([
            createWorkoutTemplate(input, userId),
            createWorkoutTemplate(input, userId),
        ]);

        expect(a.id).toBe(b.id);
        expect(await (await getCollection("workoutTemplates")).countDocuments({ userId })).toBe(1);
    });
});
