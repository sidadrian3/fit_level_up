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
    baseWorkoutCost: 15,
    workoutDurationMultiplier: 0.5,
    dailyRecovery: 50,
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

} as const;
