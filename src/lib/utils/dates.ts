const MS_PER_HOUR = 3_600_000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string, kind: "day" | "parts"): Intl.DateTimeFormat {
  const key = `${kind}|${timeZone}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const formatter =
    kind === "day"
      ? new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      : new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        });
  formatterCache.set(key, formatter);
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || /^[+-]/.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function toLocalDay(instant: Date, timeZone: string): string {
  return getFormatter(timeZone, "day").format(instant);
}

function parseDay(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function addDays(day: string, n: number): string {
  const shifted = new Date(parseDay(day));
  shifted.setUTCDate(shifted.getUTCDate() + n);
  return shifted.toISOString().slice(0, 10);
}

export function startOfWeek(day: string): string {
  const weekday = new Date(parseDay(day)).getUTCDay();
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

function zoneOffsetMs(instant: number, timeZone: string): number {
  const fields: Record<string, number> = {};
  for (const part of getFormatter(timeZone, "parts").formatToParts(new Date(instant))) {
    if (part.type !== "literal") fields[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export function startOfLocalDay(day: string, timeZone: string): Date {
  const guess = parseDay(day);
  let t = guess - zoneOffsetMs(guess, timeZone);
  t = guess - zoneOffsetMs(t, timeZone);

  // Midnight skipped by a forward clock change: the day starts at the next whole hour that is on `day`.
  while (toLocalDay(new Date(t), timeZone) < day) t += MS_PER_HOUR;
  // Midnight repeated by a backward clock change: the earlier occurrence starts the day.
  while (toLocalDay(new Date(t - MS_PER_HOUR), timeZone) === day) t -= MS_PER_HOUR;

  return new Date(t);
}
