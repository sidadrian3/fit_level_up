import { describe, it, expect } from 'vitest';
import { calcLevelUp, calcActiveDays } from '../user-rules';

describe('user-rules', () => {
  describe('calcLevelUp', () => {
    it('should correctly add XP without leveling up', () => {
      const result = calcLevelUp(100, 1, 500, 50);
      expect(result).toEqual({
        newXp: 150,
        newLevel: 1,
        newXpToNextLevel: 500,
        levelUp: false,
      });
    });

    it('should level up when XP exceeds threshold', () => {
      const result = calcLevelUp(450, 1, 500, 100);
      expect(result).toEqual({
        newXp: 50,
        newLevel: 2,
        newXpToNextLevel: 1000,
        levelUp: true,
      });
    });

    it('should handle multiple level ups at once', () => {
      // Level 1 -> 500 to level up
      // Add 2000 XP
      // Lvl 1 (450) + 2000 = 2450
      // - 500 = 1950 (Lvl 2, next 1000)
      // - 1000 = 950 (Lvl 3, next 1500)
      const result = calcLevelUp(450, 1, 500, 2000);
      expect(result).toEqual({
        newXp: 950,
        newLevel: 3,
        newXpToNextLevel: 1500,
        levelUp: true,
      });
    });
  });

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
