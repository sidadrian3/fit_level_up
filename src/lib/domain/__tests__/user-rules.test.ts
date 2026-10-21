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
    it('starts a streak at 1 with no previous activity', () => {
      expect(calcNewStreak(undefined, undefined, new Date('2026-10-21T12:00:00Z'), 'UTC')).toBe(1);
    });

    it('extends the streak on the next local day', () => {
      expect(calcNewStreak(5, '2026-10-20', new Date('2026-10-20T23:00:00Z'), 'Asia/Manila')).toBe(6);
    });

    it('keeps the streak on the same local day', () => {
      expect(calcNewStreak(5, '2026-10-20', new Date('2026-10-20T23:00:00Z'), 'UTC')).toBe(5);
    });

    it('extends the streak west of UTC when the local day is behind', () => {
      expect(calcNewStreak(5, '2026-10-20', new Date('2026-10-22T03:00:00Z'), 'America/New_York')).toBe(6);
    });

    it('resets the streak after a gap day', () => {
      expect(calcNewStreak(5, '2026-10-18', new Date('2026-10-21T12:00:00Z'), 'UTC')).toBe(1);
    });

    it('leaves the streak unchanged for a past-dated activity', () => {
      expect(calcNewStreak(5, '2026-10-20', new Date('2026-10-19T12:00:00Z'), 'UTC')).toBe(5);
    });
  });

  describe('calcDisplayStreak', () => {
    it('returns the raw streak when it is 0 or there is no last activity', () => {
      const now = new Date('2026-10-21T12:00:00Z');
      expect(calcDisplayStreak(0, undefined, now, 'UTC')).toBe(0);
      expect(calcDisplayStreak(5, undefined, now, 'UTC')).toBe(5);
    });

    it('keeps the streak when the last activity was today or yesterday', () => {
      const now = new Date('2026-10-21T12:00:00Z');
      expect(calcDisplayStreak(5, '2026-10-21', now, 'UTC')).toBe(5);
      expect(calcDisplayStreak(5, '2026-10-20', now, 'UTC')).toBe(5);
    });

    it('drops to 0 when two local days have passed', () => {
      expect(calcDisplayStreak(5, '2026-10-20', new Date('2026-10-21T20:00:00Z'), 'Asia/Manila')).toBe(0);
    });

    it('keeps the streak for the same instant in UTC', () => {
      expect(calcDisplayStreak(5, '2026-10-20', new Date('2026-10-21T20:00:00Z'), 'UTC')).toBe(5);
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
