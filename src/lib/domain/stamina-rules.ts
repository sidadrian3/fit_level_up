import { GAME_CONFIG } from "@/server/platform/config";

export function calcStaminaCost(duration: number): number {
  return GAME_CONFIG.stamina.baseWorkoutCost + (duration * GAME_CONFIG.stamina.workoutDurationMultiplier);
}

export function calcExhaustionDebuff(baseXp: number, currentStamina: number, staminaCost: number): number {
  if (currentStamina >= staminaCost) {
    return baseXp;
  }
  return Math.round(baseXp * GAME_CONFIG.xp.exhaustionDebuffMultiplier);
}
