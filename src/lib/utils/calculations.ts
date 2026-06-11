/**
 * Calculation utilities — derived data from domain models.
 * These keep business logic out of React components.
 */

import type { Run } from "@/lib/types";

/** Calculate XP progress as a percentage (clamped 0–100) */
export function calcXPPercent(xp: number, xpToNext: number): number {
  if (xpToNext <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((xp / xpToNext) * 100)));
}

/** Aggregate running stats from an array of runs */
export function calcRunStats(runs: readonly Run[]): {
  totalKm: number;
  totalRuns: number;
  avgPace: number;
} {
  const totalRuns = runs.length;
  if (totalRuns === 0) return { totalKm: 0, totalRuns: 0, avgPace: 0 };

  const totalKm = parseFloat(
    runs.reduce((sum, r) => sum + r.distance, 0).toFixed(1)
  );
  const avgPace = parseFloat(
    (runs.reduce((sum, r) => sum + r.pace, 0) / totalRuns).toFixed(2)
  );

  return { totalKm, totalRuns, avgPace };
}

/** Generic group-by utility — groups an array by a key extractor function */
export function groupBy<T, K extends string>(
  items: readonly T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
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

/** Calculate consecutive days of activity leading up to today or yesterday. */
export function calculateStreak(dates: string[]): number {
  if (!dates || dates.length === 0) return 0;

  const dateSet = new Set(dates);

  // YYYY-MM-DD strings
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const yesterday = new Date();
  yesterday.setUTCDate(now.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  //no activity today or yesterday, streak is dead
  if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  //UTC date pointer at midnight for whichever day the streak starts on
  const pointer = new Date(dateSet.has(todayStr) ? todayStr : yesterdayStr);

  // Walk backwards day by day as long as the date is in the set
  while (dateSet.has(pointer.toISOString().slice(0, 10))) {
    streak++;
    pointer.setUTCDate(pointer.getUTCDate() - 1);
  }

  return streak;
}
