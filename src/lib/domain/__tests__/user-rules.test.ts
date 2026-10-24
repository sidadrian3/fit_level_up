import { describe, it, expect } from 'vitest';
import { calcActiveDays } from '../user-rules';

describe('user-rules', () => {
  describe('calcActiveDays', () => {
    it('marks local weekdays of the current local week, Monday first', () => {
      const now = new Date('2026-10-22T02:00:00Z');
      const instants = [
        new Date('2026-10-20T03:00:00Z'),
        new Date('2026-10-21T15:00:00Z'),
        new Date('2026-10-19T03:00:00Z'),
      ];
      expect(calcActiveDays(instants, now, 'America/New_York')).toEqual([true, false, true, false, false, false, false]);
    });
  });
});
