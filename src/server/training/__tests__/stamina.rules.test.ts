import { describe, it, expect } from 'vitest';
import { calcStaminaCost, calcExhaustionDebuff } from '../stamina.rules';

describe('stamina.rules', () => {
  describe('calcStaminaCost', () => {
    it('should calculate the correct cost for a 60 minute workout', () => {
      expect(calcStaminaCost(60)).toBe(22); // 10 + (60 * 0.2)
    });

    it('should charge the minimum base cost of 10 for a 0 minute workout', () => {
      expect(calcStaminaCost(0)).toBe(10);
    });
  });

  describe('calcExhaustionDebuff', () => {
    it('should not reduce XP if user has enough stamina', () => {
      // Base XP is 100. Current stamina is 50, cost is 30. User has enough.
      expect(calcExhaustionDebuff(100, 50, 30)).toBe(100);
    });

    it('should not reduce XP if user has exactly enough stamina', () => {
      expect(calcExhaustionDebuff(100, 30, 30)).toBe(100);
    });

    it('should reduce XP by 50% if user does not have enough stamina', () => {
      // Base XP is 100. Current stamina is 20, cost is 30. User does NOT have enough.
      expect(calcExhaustionDebuff(100, 20, 30)).toBe(50);
    });
    
    it('should round the reduced XP if it is a decimal', () => {
      expect(calcExhaustionDebuff(101, 20, 30)).toBe(51); // 101 * 0.5 = 50.5 -> round to 51
    });
  });
});
