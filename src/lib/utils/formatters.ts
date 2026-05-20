/**
 * Pure formatting utilities.
 * Each function converts a raw value into a human-readable display string.
 * No side effects, no imports — trivially unit-testable.
 */

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatPace(pace: number): string {
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
}

export function formatXP(xp: number): string {
  return `${xp.toLocaleString()} XP`;
}

export function formatDistance(km: number): string {
  return `${km} km`;
}
