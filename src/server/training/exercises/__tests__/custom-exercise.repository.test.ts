import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { listCustomExercisesForUser, insertCustomExercise } from '../custom-exercise.repository';
import { getCollection } from "@/server/platform/database";
import { TargetMuscle } from '@/shared/contracts/exercise';

describe('custom-exercise repository Test', () => {
    const userId = "db-user-id";

    beforeAll(async () => {
        const exercisesCol = await getCollection("customExercises");
        await exercisesCol.deleteMany({ userId });
    });

    afterAll(async () => {
        const exercisesCol = await getCollection("customExercises");
        await exercisesCol.deleteMany({ userId });
    });

    it('should create an exercise and assign an _id', async () => {
        const doc = await insertCustomExercise({
            userId,
            name: "DB Test Exercise",
            targetMuscle: TargetMuscle.Core
        });
        
        expect(doc.id).toBeDefined();
        expect(doc.userId).toBe(userId);
    });

    it('listCustomExercisesForUser should map _id to id correctly', async () => {
        const exercises = await listCustomExercisesForUser(userId);
        
        expect(exercises.length).toBe(1);
        expect(exercises[0].id).toBeDefined();
        expect(exercises[0]).not.toHaveProperty("_id");
    });
});
