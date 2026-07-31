import { describe, it, expect, vi } from 'vitest';
import { evaluateWorkout } from '../workout-evaluator';
import { CreateWorkoutInput, TargetMuscle, Exercise } from '@/lib/types';

vi.mock('../workout-rules', () => ({
    validateWorkoutInput: vi.fn(),
    filterNamedExercises: vi.fn(() => [{ name: 'Pushups', targetMuscle: TargetMuscle.Chest, sets: 3, reps: 10, weight: null }]),
    calcWorkoutXP: vi.fn(() => 100),
}));

vi.mock('../stamina-rules', () => ({
    calcStaminaCost: vi.fn(() => 20),
    calcExhaustionDebuff: vi.fn(() => 90),
}));

describe('workout-evaluator', () => {
    it('should evaluate a workout and return all necessary fields', () => {
        const input: CreateWorkoutInput = {
            title: 'Morning Workout',
            duration: 30,
            exercises: [
                { name: 'Pushups', targetMuscle: TargetMuscle.Chest, sets: 3, reps: 10, weight: null },
                { name: '', targetMuscle: TargetMuscle.Core, sets: 0, reps: 0, weight: null }
            ],
            idempotencyKey: 123
        };
        const result = evaluateWorkout(input, 100);
        
        expect(result).toEqual({
            exercises: [{ name: 'Pushups', targetMuscle: TargetMuscle.Chest, sets: 3, reps: 10, weight: null }],
            baseXpEarned: 100,
            staminaCost: 20,
            finalXpEarned: 90
        });
    });
});
