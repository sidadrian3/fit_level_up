import { describe, it, expect } from 'vitest';
import { calcStaminaCost, calcRecoveredStamina, calcExhaustionDebuff } from '../stamina-rules';

describe('stamina-rules', () => {
  describe('calcStaminaCost', () => {
    it('should calculate the correct cost for a 60 minute workout', () => {
      expect(calcStaminaCost(60)).toBe(45); // 15 + (60 * 0.5)
    });

    it('should charge the minimum base cost of 15 for a 0 minute workout', () => {
      expect(calcStaminaCost(0)).toBe(15);
    });
  });

  describe('calcRecoveredStamina', () => {
    it('should recover 50 stamina if exactly one day has passed', () => {
      // Current stamina is 20. Updated yesterday. Should add 50. Total 70.
      expect(calcRecoveredStamina(20, '2024-01-01T12:00:00Z', new Date('2024-01-02T12:00:00Z'))).toBe(70);
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
      // Formula suggestion: 50 stamina per day. 2 days = 100.
      expect(calcRecoveredStamina(10, '2024-01-01T12:00:00Z', new Date('2024-01-03T12:00:00Z'))).toBe(100); 
    });
    
    it('should return 100 if no lastUpdateDate is provided (new user or uninitialized)', () => {
       expect(calcRecoveredStamina(0, undefined, new Date('2024-01-01T12:00:00Z'))).toBe(100);
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
