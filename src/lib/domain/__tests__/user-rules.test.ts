import { describe, it, expect } from 'vitest';
import { calcLevelUp, calcNewStreak, calcDisplayStreak, calcLifetimeXp } from '../user-rules';

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

  describe('calcNewStreak', () => {
    it('should start a streak at 1 if no previous activity', () => {
      expect(calcNewStreak(undefined, undefined, '2024-01-01')).toBe(1);
    });

    it('should keep streak the same if logging multiple times on the same day', () => {
      expect(calcNewStreak(5, '2024-01-01', '2024-01-01')).toBe(5);
    });

    it('should extend streak if logging on the consecutive day', () => {
      expect(calcNewStreak(5, '2024-01-01', '2024-01-02')).toBe(6);
    });

    it('should reset streak to 1 if there is a gap day', () => {
      expect(calcNewStreak(5, '2024-01-01', '2024-01-03')).toBe(1);
    });

    it('should handle Date objects properly', () => {
      expect(calcNewStreak(5, new Date('2024-01-01T12:00:00Z'), '2024-01-02')).toBe(6);
    });
  });

  describe('calcDisplayStreak', () => {
    it('should return raw streak if 0 or no last activity date', () => {
      expect(calcDisplayStreak(0, undefined)).toBe(0);
      expect(calcDisplayStreak(5, undefined)).toBe(5);
    });

    it('should return raw streak if last activity was today', () => {
      const today = new Date();
      expect(calcDisplayStreak(5, today, today)).toBe(5);
    });

    it('should return raw streak if last activity was yesterday', () => {
      const today = new Date('2024-01-02T12:00:00Z');
      const yesterday = new Date('2024-01-01T12:00:00Z');
      expect(calcDisplayStreak(5, yesterday, today)).toBe(5);
    });

    it('should return 0 if last activity was before yesterday', () => {
      const today = new Date('2024-01-03T12:00:00Z');
      const twoDaysAgo = new Date('2024-01-01T12:00:00Z');
      expect(calcDisplayStreak(5, twoDaysAgo, today)).toBe(0);
    });
  });

  describe('calcLifetimeXp', () => {
    it('should calculate lifetime XP correctly', () => {
      // Level 3 means they completed L1 (500) and L2 (1000) = 1500 XP
      // Plus current XP
      expect(calcLifetimeXp(3, 200)).toBe(1700);
    });
  });
});
