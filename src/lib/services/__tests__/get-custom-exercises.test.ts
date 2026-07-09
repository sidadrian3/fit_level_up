import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getCustomExercises } from '../exercises/get-custom-exercises';
import { getCollection } from '../../data/get-collection';
import { TargetMuscle } from '../../types';
import { CustomExerciseDoc } from '../../data/custom-exercises-db';

describe('getCustomExercises Integration Test', () => {
    const userId1 = "user-1";
    const userId2 = "user-2";

    beforeAll(async () => {
        // Setup initial data
        const exercisesCol = await getCollection<CustomExerciseDoc>("customExercisesCollection");
        await exercisesCol.insertMany([
            { userId: userId1, name: "Squat", targetMuscle: TargetMuscle.Legs },
            { userId: userId1, name: "Bench", targetMuscle: TargetMuscle.Chest },
            { userId: userId2, name: "Deadlift", targetMuscle: TargetMuscle.Back },
        ]);
    });

    afterAll(async () => {
        const exercisesCol = await getCollection("customExercisesCollection");
        await exercisesCol.deleteMany({ userId: { $in: [userId1, userId2] } });
    });

    it('should return an empty array if the user has no custom exercises', async () => {
        const result = await getCustomExercises("non-existent-user");
        expect(result).toEqual([]);
    });

    it('should return only the custom exercises belonging to the specific userId', async () => {
        const result = await getCustomExercises(userId1);
        
        expect(result.length).toBe(2);
        expect(result.map(e => e.name).sort()).toEqual(["Bench", "Squat"]);
        
        // Verify cross-contamination prevention
        const result2 = await getCustomExercises(userId2);
        expect(result2.length).toBe(1);
        expect(result2[0].name).toBe("Deadlift");
    });
});
