export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getMondayDateString(date = new Date()): string {
  const current = new Date(date);
  const day = current.getDay();

  const diffToMonday = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diffToMonday);

  return current.toISOString().slice(0, 10);
}

export function getSundayDateString(date = new Date()): string {
  const current = new Date(date);
  const day = current.getDay();

  const diffToSunday = day === 0 ? 0 : 7 - day;
  current.setDate(current.getDate() + diffToSunday);

  return current.toISOString().slice(0, 10);
}

export function getLastWeekBoundaries(date = new Date()): { lastMonday: string; lastSunday: string } {
  const current = new Date(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  const lastMonday = new Date(current);
  lastMonday.setDate(current.getDate() + diff - 7);

  const lastSunday = new Date(current);
  lastSunday.setDate(current.getDate() + diff - 1);

  return {
    lastMonday: lastMonday.toISOString().slice(0, 10),
    lastSunday: lastSunday.toISOString().slice(0, 10)
  };
}
