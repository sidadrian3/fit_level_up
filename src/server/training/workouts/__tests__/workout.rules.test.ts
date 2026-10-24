import { describe, it, expect } from 'vitest';
import { evaluateWorkout } from '../workout.rules';
import { CreateWorkoutInput, TargetMuscle } from '@/lib/types';

const input: CreateWorkoutInput = {
    title: 'Morning Workout',
    duration: 30,
    exercises: [
        { name: 'Pushups', targetMuscle: TargetMuscle.Chest, sets: 3, reps: 10, weight: null },
        { name: '', targetMuscle: TargetMuscle.Core, sets: 0, reps: 0, weight: null }
    ],
};

describe('evaluateWorkout', () => {
    it('should evaluate a workout and return all necessary fields', () => {
        expect(evaluateWorkout(input, 100)).toEqual({
            exercises: [input.exercises[0]],
            baseXpEarned: 75,
            staminaCost: 16,
            finalXpEarned: 75
        });
    });

    it('halves the XP when stamina cannot cover the cost', () => {
        expect(evaluateWorkout(input, 0).finalXpEarned).toBe(38);
    });

    it('rejects a workout with no named exercise', () => {
        expect(() => evaluateWorkout({ ...input, exercises: [input.exercises[1]] }, 100)).toThrow();
    });
});
