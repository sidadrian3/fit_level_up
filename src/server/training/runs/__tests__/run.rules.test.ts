import { describe, it, expect } from 'vitest';
import { evaluateRun } from '../run.rules';
import type { CreateRunInput } from '@/shared/contracts/run';

const input: CreateRunInput = { distance: 5, duration: 25, difficulty: 'moderate' };

describe('evaluateRun', () => {
    it('should evaluate a run and return all necessary fields', () => {
        expect(evaluateRun(input, 100)).toEqual({
            baseXpEarned: 120,
            pace: 5,
            staminaCost: 15,
            finalXpEarned: 120
        });
    });

    it('halves the XP when stamina cannot cover the cost', () => {
        expect(evaluateRun(input, 0).finalXpEarned).toBe(60);
    });

    it('rejects a run with no distance', () => {
        expect(() => evaluateRun({ ...input, distance: 0 }, 100)).toThrow();
    });
});
