import { describe, it, expect } from 'vitest';
import {
  calcDisplayStreak,
  calcLifetimeXp,
  calcNewStreak,
  calcRecoveredStamina,
  levelFromTotalXp,
} from '../progression.rules';

describe('progression.rules', () => {
  describe('levelFromTotalXp', () => {
    it('starts at level 1 with no XP', () => {
      expect(levelFromTotalXp(0)).toEqual({ level: 1, xp: 0, xpToNextLevel: 500 });
    });

    it('adds XP without leveling up', () => {
      expect(levelFromTotalXp(100 + 50)).toEqual({ level: 1, xp: 150, xpToNextLevel: 500 });
    });

    it('levels up when XP exceeds the threshold', () => {
      expect(levelFromTotalXp(450 + 100)).toEqual({ level: 2, xp: 50, xpToNextLevel: 1000 });
    });

    it('handles multiple level ups at once', () => {
      expect(levelFromTotalXp(450 + 2000)).toEqual({ level: 3, xp: 950, xpToNextLevel: 1500 });
    });

    it('round-trips with calcLifetimeXp', () => {
      for (let level = 1; level <= 20; level++) {
        for (const xp of [0, level * 500 - 1]) {
          expect(levelFromTotalXp(calcLifetimeXp(level, xp))).toEqual({
            level,
            xp,
            xpToNextLevel: level * 500,
          });
        }
      }
    });
  });

  describe('calcLifetimeXp', () => {
    it('should calculate lifetime XP correctly', () => {
      // Level 3 means they completed L1 (500) and L2 (1000) = 1500 XP
      // Plus current XP
      expect(calcLifetimeXp(3, 200)).toBe(1700);
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

  describe('calcRecoveredStamina', () => {
    it('should recover 100 stamina if exactly one day has passed', () => {
      // Current stamina is 20. Updated yesterday. Should add 100. Total 120 -> cap 100
      expect(calcRecoveredStamina(20, '2024-01-01T12:00:00Z', new Date('2024-01-02T12:00:00Z'))).toBe(100);
    });

    it('should cap stamina at 100 after recovery', () => {
      // Current stamina is 80. Updated yesterday. Adding 50 would be 130, cap at 100.
      expect(calcRecoveredStamina(80, '2024-01-01T12:00:00Z', new Date('2024-01-02T12:00:00Z'))).toBe(100);
    });

    it('should not recover stamina if same day', () => {
      // Current stamina is 50. Updated earlier today. Add 0. Total 50.
      expect(calcRecoveredStamina(50, '2024-01-01T08:00:00Z', new Date('2024-01-01T18:00:00Z'))).toBe(50);
    });

    it('should recover full stamina if multiple days have passed', () => {
      // Formula suggestion: 100 stamina per day. 2 days = 200.
      expect(calcRecoveredStamina(10, '2024-01-01T12:00:00Z', new Date('2024-01-03T12:00:00Z'))).toBe(100); 
    });
    
    it('should return 100 if no lastUpdateDate is provided (new user or uninitialized)', () => {
       expect(calcRecoveredStamina(0, undefined, new Date('2024-01-01T12:00:00Z'))).toBe(100);
    });
  });
});
