import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createCustomExercise } from '../exercises/create-custom-exercise';
import { getCollection } from '../../data/get-collection';
import { TargetMuscle } from '../../types';

describe('createCustomExercise Integration Test', () => {
    const userId = "test-user-id-123";

    afterEach(async () => {
        // Clean up custom exercises between tests
        const exercisesCol = await getCollection("customExercisesCollection");
        await exercisesCol.deleteMany({ userId });
    });

    it('should successfully create a new custom exercise and return it mapped to the domain model', async () => {
        const exercise = await createCustomExercise(userId, "  incline dumbbelL press ", TargetMuscle.Chest);

        // 1. Verify returned object
        expect(exercise.id).toBeDefined();
        expect(exercise.userId).toBe(userId);
        expect(exercise.name).toBe("Incline Dumbbell Press"); // Testing formatting rule
        expect(exercise.targetMuscle).toBe(TargetMuscle.Chest);

        // 2. Verify it's actually in the database
        const exercisesCol = await getCollection("customExercisesCollection");
        const doc = await exercisesCol.findOne({ userId, name: "Incline Dumbbell Press", targetMuscle: TargetMuscle.Chest });
        expect(doc).toBeDefined();
    });

    it('should prevent duplicate custom exercises with the same name and muscle group', async () => {
        // 1. Create first exercise
        await createCustomExercise(userId, "Bulgarian Split Squat", TargetMuscle.Legs);

        // 2. Attempt to create the same exercise again (case difference should also trigger it since we format it)
        await expect(
            createCustomExercise(userId, "bulgarian split squat", TargetMuscle.Legs)
        ).rejects.toThrow("You already created an exercise with this name for this muscle group.");
        
        // 3. Verify only ONE exercise exists in the DB
        const exercisesCol = await getCollection("customExercisesCollection");
        const allExercises = await exercisesCol.find({ userId }).toArray();
        expect(allExercises.length).toBe(1);
        expect(allExercises[0].name).toBe("Bulgarian Split Squat");
    });
});
