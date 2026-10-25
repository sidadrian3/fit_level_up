import "server-only";

export const GAME_CONFIG = {
  xp: {
    workout: {
      durationMultiplier: 2,
      exerciseMultiplier: 15,
    },
    run: {
      distanceMultiplier: 10,
      durationMultiplier: 2,
    },
    exhaustionDebuffMultiplier: 0.5,
  },
  stamina: {
    baseWorkoutCost: 10,
    workoutDurationMultiplier: 0.2,
    dailyRecovery: 100,
  },
  leveling: {
    xpPerLevelMultiplier: 500, // newLevel * 500
  },
  runDifficultyMultipliers: {
    easy: 1,
    moderate: 1.2,
    hard: 1.5,
    intense: 2
},
  social: {
    friendRequestCooldownDays: 7,
  },
} as const;

export const RATE_LIMIT_TIERS = {
  standard: { requests: 30, window: "1 m" },
  expensive: { requests: 10, window: "1 h" },
} as const;

export const OUTBOX_TUNING = {
    leaseMs: 2 * 60_000,
    maxAttempts: 8,
    backoffBaseMs: 60_000,
    backoffCapMs: 6 * 3_600_000,
    overduePerRequest: 3,
    cronBudgetMs: 240_000,
} as const;
