import { addDays, startOfWeek, toLocalDay } from "@/shared/time/calendar";

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

