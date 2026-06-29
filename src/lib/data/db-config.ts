export function getDbConfig() {
  const dbName = process.env.MONGODB_DB;
  
  if (!dbName) {
    throw new Error("Missing MONGODB_DB in .env.local");
  }

  return {
    dbName,
    usersCollection: "user",
    workoutsCollection: process.env.MONGODB_WORKOUTS_COLLECTION || "workouts",
    runsCollection: process.env.MONGODB_RUNS_COLLECTION || "runs",
    questTemplatesCollection: process.env.MONGODB_QUEST_TEMPLATES_COLLECTION || "quest_templates",
    userQuestsCollection: process.env.MONGODB_USER_QUESTS_COLLECTION || "user_quests",
    achievementsCollection: process.env.MONGODB_ACHIEVEMENTS_COLLECTION || "achievements",
    userAchievementsCollection: process.env.MONGODB_USER_ACHIEVEMENTS_COLLECTION || "user_achievements",
  };
}
