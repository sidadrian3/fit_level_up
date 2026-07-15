import { env } from "../../env";

export function getDbConfig() {
  const dbName = env.MONGODB_DB;

  if (!dbName) {
    throw new Error("Missing MONGODB_DB in .env.local");
  }

  return {
    dbName,
    usersCollection: "user",
    workoutsCollection: env.MONGODB_WORKOUTS_COLLECTION || "workouts",
    runsCollection: env.MONGODB_RUNS_COLLECTION || "runs",
    questTemplatesCollection: env.MONGODB_QUEST_TEMPLATES_COLLECTION || "quest_templates",
    userQuestsCollection: env.MONGODB_USER_QUESTS_COLLECTION || "user_quests",
    achievementsCollection: env.MONGODB_ACHIEVEMENTS_COLLECTION || "achievements",
    userAchievementsCollection: env.MONGODB_USER_ACHIEVEMENTS_COLLECTION || "user_achievements",
    customExercisesCollection: env.MONGODB_CUSTOM_EXERCISES_COLLECTION || "custom_exercises",
    friendshipsCollection: env.MONGODB_FRIENDSHIPS_COLLECTION || "friendships",
    
  };
}
