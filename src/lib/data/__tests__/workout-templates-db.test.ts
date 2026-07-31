import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getCollection } from '../get-collection';
import { ensureIndexes } from '../ensure-indexes';
import { 
    getWorkoutTemplatesFromDb, 
    createWorkoutTemplateInDb, 
    deleteWorkoutTemplateFromDb,
    WorkoutTemplateMongoDoc
} from '../workout-templates-db';
import { TargetMuscle } from '@/lib/types';
import crypto from 'crypto';

describe("workout-templates-db Data Layer Test", () => {
    const userId = "db-user-id";

    beforeAll(async () => {
        await ensureIndexes();
    });

    beforeEach(async () => {
        const col = await getCollection<WorkoutTemplateMongoDoc>("workoutTemplatesCollection");
        await col.deleteMany({ userId });
    });

    afterAll(async () => {
        const col = await getCollection<WorkoutTemplateMongoDoc>("workoutTemplatesCollection");
        await col.deleteMany({ userId });
    });

    it("should create a workout template and assign an id", async () => {
        const idempotencyKey = crypto.randomUUID();
        const template = await createWorkoutTemplateInDb({
            userId,
            name: "Push Day",
            exercises: [
                { name: "Bench Press", targetMuscle: TargetMuscle.Chest, sets: 3, reps: 10, weight: 135 }
            ],
            idempotencyKey,
            createdAt: new Date().toISOString()
        });

        expect(template.id).toBeDefined();
        expect(template.userId).toBe(userId);
        expect(template.name).toBe("Push Day");
        expect(template.exercises).toHaveLength(1);
    });

    it("should enforce idempotency for templates", async () => {
        const idempotencyKey = crypto.randomUUID();
        const input = {
            userId,
            name: "Leg Day",
            exercises: [
                { name: "Squat", targetMuscle: TargetMuscle.Legs, sets: 3, reps: 10, weight: 225 }
            ],
            idempotencyKey,
            createdAt: new Date().toISOString()
        };

        const first = await createWorkoutTemplateInDb(input);
        const second = await createWorkoutTemplateInDb(input);

        expect(first.id).toBeDefined();
        expect(first.id).toBe(second.id); // Same document returned

        const docs = await getWorkoutTemplatesFromDb(userId);
        expect(docs).toHaveLength(1); // No duplicates created
    });

    it("should retrieve all templates for a user", async () => {
        await createWorkoutTemplateInDb({
            userId,
            name: "Template 1",
            exercises: [],
            idempotencyKey: crypto.randomUUID(),
            createdAt: "2024-01-01T12:00:00Z"
        });

        await createWorkoutTemplateInDb({
            userId,
            name: "Template 2",
            exercises: [],
            idempotencyKey: crypto.randomUUID(),
            createdAt: "2024-01-02T12:00:00Z"
        });

        const docs = await getWorkoutTemplatesFromDb(userId);
        expect(docs).toHaveLength(2);
        // Sorted by createdAt descending
        expect(docs[0].name).toBe("Template 2");
        expect(docs[1].name).toBe("Template 1");
    });

    it("should delete a template if it belongs to the user", async () => {
        const template = await createWorkoutTemplateInDb({
            userId,
            name: "To Delete",
            exercises: [],
            idempotencyKey: crypto.randomUUID(),
            createdAt: new Date().toISOString()
        });

        const deleted = await deleteWorkoutTemplateFromDb(userId, template.id);
        expect(deleted).toBe(true);

        const docs = await getWorkoutTemplatesFromDb(userId);
        expect(docs).toHaveLength(0);
    });

    it("should not delete a template if it belongs to another user", async () => {
        const template = await createWorkoutTemplateInDb({
            userId: "other-user-id",
            name: "Other User's Template",
            exercises: [],
            idempotencyKey: crypto.randomUUID(),
            createdAt: new Date().toISOString()
        });

        const deleted = await deleteWorkoutTemplateFromDb(userId, template.id);
        expect(deleted).toBe(false); // Can't delete another user's template
    });
});
