import { GAME_CONFIG } from "@/server/platform/config";
import { addDays, toLocalDay } from "@/shared/time/calendar";

export type LevelProgress = {
  level: number;
  xp: number;
  xpToNextLevel: number;
};

export function levelFromTotalXp(totalXp: number): LevelProgress {
  let level = 1;
  let xp = totalXp;
  let xpToNextLevel = GAME_CONFIG.leveling.xpPerLevelMultiplier;

  while (xp >= xpToNextLevel) {
    xp -= xpToNextLevel;
    level += 1;
    xpToNextLevel = level * GAME_CONFIG.leveling.xpPerLevelMultiplier;
  }

  return { level, xp, xpToNextLevel };
}

export function calcLifetimeXp(level: number, currentXp: number): number {
  let lifetimeXP = 0;
  for (let i = 1; i < level; i++) {
    lifetimeXP += i * GAME_CONFIG.leveling.xpPerLevelMultiplier;
  }
  lifetimeXP += currentXp;
  return lifetimeXP;
}

export function calcNewStreak(
  currentStreak: number | undefined,
  lastActivityDay: string | undefined,
  now: Date,
  timeZone: string
): number {
  if (!lastActivityDay) return 1;

  const today = toLocalDay(now, timeZone);
  if (addDays(lastActivityDay, 1) === today) return (currentStreak ?? 0) + 1;
  if (addDays(lastActivityDay, 1) < today) return 1;

  // Same day or a past-dated activity leaves the streak unchanged
  return currentStreak ?? 1;
}

export function calcDisplayStreak(
  rawStreak: number,
  lastActivityDay: string | undefined,
  now: Date,
  timeZone: string
): number {
  if (rawStreak <= 0 || !lastActivityDay) return rawStreak;

  const today = toLocalDay(now, timeZone);
  const isStreakAlive = lastActivityDay === today || addDays(lastActivityDay, 1) === today;
  return isStreakAlive ? rawStreak : 0;
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

export function recountStreak(days: readonly string[]): { streak: number; lastActivityDay: string } {
  const distinctDays = new Set(days);
  const lastActivityDay = [...distinctDays].sort().at(-1)!;

  let streak = 1;
  while (distinctDays.has(addDays(lastActivityDay, -streak))) streak += 1;

  return { streak, lastActivityDay };
}
