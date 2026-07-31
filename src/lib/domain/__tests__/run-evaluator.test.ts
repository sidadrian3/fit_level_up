import { describe, it, expect, vi } from 'vitest';
import { evaluateRun } from '../run-evaluator';
import { CreateRunInput } from '@/lib/types';

vi.mock('../run-rules', () => ({
    validateRunInput: vi.fn(),
    calcRunXP: vi.fn(() => 200),
    calcPace: vi.fn(() => 5),
}));

vi.mock('../stamina-rules', () => ({
    calcStaminaCost: vi.fn(() => 40),
    calcExhaustionDebuff: vi.fn(() => 180),
}));

describe('run-evaluator', () => {
    it('should evaluate a run and return all necessary fields', () => {
        const input: CreateRunInput = {
            distance: 5,
            duration: 25,
            difficulty: 'moderate',
            idempotencyKey: '456'
        };
        const result = evaluateRun(input, 100);
        
        expect(result).toEqual({
            baseXpEarned: 200,
            pace: 5,
            staminaCost: 40,
            finalXpEarned: 180
        });
    });
});
