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
  lastDate: string | undefined,
  activityDate: string
): number {
  if (!lastDate) {
    // First ever activity
    return 1;
  }
  
  if (lastDate === activityDate) {
    // Already logged activity today — streak unchanged
    return currentStreak ?? 1;
  }
  
  // Check if lastDate was yesterday
  const last = new Date(lastDate + "T00:00:00Z");
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

