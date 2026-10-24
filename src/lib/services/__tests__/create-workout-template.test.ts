import { describe, it, expect, beforeAll, afterEach } from "vitest";
import crypto from "crypto";
import { createWorkoutTemplate } from "../workout-templates/create-workout-template";
import { IdempotencyKeyReusedError } from "@/server/platform/http";
import { getCollection } from "@/server/platform/database";
import { TargetMuscle } from "@/lib/types";

const userId = "template-service-user";

function buildRequest(fingerprint = "f1") {
    return { key: crypto.randomUUID(), fingerprint };
}

function buildInput() {
    return {
        name: "Upper Body Power",
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
        const { value: template, replayed } = await createWorkoutTemplate(buildInput(), userId, buildRequest());

        expect(replayed).toBe(false);
        expect(template.id).toBeDefined();
        expect(template.userId).toBe(userId);
        expect(template.name).toBe("Upper Body Power");
        expect(Number.isNaN(Date.parse(template.createdAt))).toBe(false);
    });

    it("stores the fingerprint on the template", async () => {
        const request = buildRequest("fingerprint-abc");

        await createWorkoutTemplate(buildInput(), userId, request);

        const doc = await (await getCollection("workoutTemplates")).findOne({ userId, idempotencyKey: request.key });
        expect(doc!.idempotencyFingerprint).toBe("fingerprint-abc");
    });

    it("returns the existing template when the same idempotency key is retried", async () => {
        const input = buildInput();
        const request = buildRequest();

        const first = await createWorkoutTemplate(input, userId, request);
        const retry = await createWorkoutTemplate(input, userId, request);

        expect(first.replayed).toBe(false);
        expect(retry.replayed).toBe(true);
        expect(retry.value.id).toBe(first.value.id);
        expect(await (await getCollection("workoutTemplates")).countDocuments({ userId })).toBe(1);
    });

    it("resolves racing retries to one row without an error", async () => {
        const input = buildInput();
        const request = buildRequest();

        const [a, b] = await Promise.all([
            createWorkoutTemplate(input, userId, request),
            createWorkoutTemplate(input, userId, request),
        ]);

        expect(a.value.id).toBe(b.value.id);
        expect(await (await getCollection("workoutTemplates")).countDocuments({ userId })).toBe(1);
    });

    it("rejects the same key with a different fingerprint with 422 and saves nothing new", async () => {
        const key = crypto.randomUUID();
        await createWorkoutTemplate(buildInput(), userId, { key, fingerprint: "f1" });

        const retry = createWorkoutTemplate(buildInput(), userId, { key, fingerprint: "f2" });

        await expect(retry).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
        await expect(retry).rejects.toThrow(
            "This template was already saved with your earlier details. Submit again to save a new one."
        );
        expect(await (await getCollection("workoutTemplates")).countDocuments({ userId })).toBe(1);
    });
});
