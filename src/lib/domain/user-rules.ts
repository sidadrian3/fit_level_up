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
    newXpToNextLevel = newLevel * 500;
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
    lifetimeXP += i * 500;
  }
  lifetimeXP += currentXp;
  return lifetimeXP;
}

export function calcNewStreak(
  currentStreak: number | undefined,
  lastDate: Date | string | undefined,
  activityDate: string
): number {
  if (!lastDate) {
    // First ever activity
    return 1;
  }

  const lastDateStr = lastDate instanceof Date ? lastDate.toISOString().slice(0, 10) : lastDate;

  if (lastDateStr === activityDate) {
    // Already logged activity today — streak unchanged
    return currentStreak ?? 1;
  }

  // Check if lastDate was yesterday
  const last = new Date(lastDateStr + "T00:00:00Z");
  const current = new Date(activityDate + "T00:00:00Z");
  const diffMs = current.getTime() - last.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays === 1) {
    // Consecutive day — extend streak
    return (currentStreak ?? 0) + 1;
  } else if (diffDays > 1) {
    // Gap — reset streak
    return 1;
  }

  // Same day or past date — don't change
  return currentStreak ?? 1;
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
