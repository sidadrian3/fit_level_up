import { GAME_CONFIG } from "@/lib/config/game-config";
import { addDays, toLocalDay } from "@/lib/utils/dates";

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

/** Calculate which days of the current week (Monday-Sunday) the user was active. */
export function calcActiveDays(dates: string[]): boolean[] {
  const activeDays = [false, false, false, false, false, false, false];

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  dates.forEach(dateStr => {
    const d = new Date(dateStr);
    if (d >= startOfWeek && d < endOfWeek) {
      const day = d.getDay();
      const index = day === 0 ? 6 : day - 1;
      activeDays[index] = true;
    }
  });

  return activeDays;
}

