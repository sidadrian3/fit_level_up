import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAllCustomExercisesFromDb, getCustomExerciseByNameFromDb, createCustomExerciseFromDb } from '../custom-exercises-db';
import { getCollection } from '../get-collection';
import { TargetMuscle } from '../../types';

describe('custom-exercises-db Data Layer Test', () => {
    const userId = "db-user-id";

    beforeAll(async () => {
        const exercisesCol = await getCollection("customExercisesCollection");
        await exercisesCol.deleteMany({ userId });
    });

    afterAll(async () => {
        const exercisesCol = await getCollection("customExercisesCollection");
        await exercisesCol.deleteMany({ userId });
    });

    it('should create an exercise and assign an _id', async () => {
        const doc = await createCustomExerciseFromDb({
            userId,
            name: "DB Test Exercise",
            targetMuscle: TargetMuscle.Core
        });
        
        expect(doc._id).toBeDefined();
        expect(doc.userId).toBe(userId);
    });

    it('getAllCustomExercisesFromDb should map _id to id correctly', async () => {
        const exercises = await getAllCustomExercisesFromDb(userId);
        
        expect(exercises.length).toBe(1);
        expect(exercises[0].id).toBeDefined();
        // @ts-expect-error: verify _id is stripped
        expect(exercises[0]._id).toBeUndefined(); // Should not leak internal _id
    });

    it('getCustomExerciseByNameFromDb should find a single document', async () => {
        const doc = await getCustomExerciseByNameFromDb(userId, "DB Test Exercise", TargetMuscle.Core);
        expect(doc).toBeDefined();
        expect(doc?.name).toBe("DB Test Exercise");
        
        const notFound = await getCustomExerciseByNameFromDb(userId, "Non Existent", TargetMuscle.Core);
        expect(notFound).toBeNull();
    });
});
