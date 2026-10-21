import { GAME_CONFIG } from "@/lib/config/game-config";
import { addDays, startOfWeek, toLocalDay } from "@/lib/utils/dates";

export type LevelUpResult = {
  newXp: number;
  newLevel: number;
  newXpToNextLevel: number;
  levelUp: boolean;
};

export function calcLevelUp(
  currentXp: number,
  currentLevel: number,
  currentXpToNextLevel: number,
  addedXp: number
): LevelUpResult {
  let newXp = currentXp + addedXp;
  let newLevel = currentLevel;
  let newXpToNextLevel = currentXpToNextLevel;
  let levelUp = false;

  while (newXp >= newXpToNextLevel) {
    newXp -= newXpToNextLevel;
    newLevel += 1;
    newXpToNextLevel = newLevel * GAME_CONFIG.leveling.xpPerLevelMultiplier;
    levelUp = true;
  }

  return {
    newXp,
    newLevel,
    newXpToNextLevel,
    levelUp,
  };
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

/** Which days of the user's current local week (Monday-Sunday) had activity. */
export function calcActiveDays(activityInstants: Date[], now: Date, timeZone: string): boolean[] {
  const activeDays = [false, false, false, false, false, false, false];
  const weekStart = startOfWeek(toLocalDay(now, timeZone));
  const weekEnd = addDays(weekStart, 7);

  for (const instant of activityInstants) {
    const day = toLocalDay(instant, timeZone);
    if (day >= weekStart && day < weekEnd) {
      activeDays[dayIndexInWeek(weekStart, day)] = true;
    }
  }

  return activeDays;
}

function dayIndexInWeek(weekStart: string, day: string): number {
  return Math.round((Date.parse(day) - Date.parse(weekStart)) / 86_400_000);
}

