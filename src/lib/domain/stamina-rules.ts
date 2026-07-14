import { GAME_CONFIG } from "@/lib/config/game-config";

export function calcStaminaCost(duration: number): number {
  return GAME_CONFIG.stamina.baseWorkoutCost + (duration * GAME_CONFIG.stamina.workoutDurationMultiplier);
}

export function calcRecoveredStamina(currentStamina: number, lastUpdateDate: Date | string | undefined, currentDate: Date): number {
  if (!lastUpdateDate) return 100;

  const lastDate = new Date(lastUpdateDate);
  lastDate.setUTCHours(0, 0, 0, 0);

  const currDate = new Date(currentDate);
  currDate.setUTCHours(0, 0, 0, 0);

  const diffTime = currDate.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return currentStamina;

  const newStamina = currentStamina + (diffDays * GAME_CONFIG.stamina.dailyRecovery);
  return Math.min(100, newStamina);
}

export function calcExhaustionDebuff(baseXp: number, currentStamina: number, staminaCost: number): number {
  if (currentStamina >= staminaCost) {
    return baseXp;
  }
  return Math.round(baseXp * GAME_CONFIG.xp.exhaustionDebuffMultiplier);
}
