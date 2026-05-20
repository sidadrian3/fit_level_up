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
