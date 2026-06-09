/**
 * Re-exports every domain so existing imports like
 *   import { getWorkouts, getUser } from "@/lib/data/repositories"
 * keep working unchanged.
 */

export { getUser } from "./user";
export { getWorkouts, createWorkout, deleteWorkout, updateWorkout } from "./workouts";
export { getRuns, createRun, deleteRun, updateRun } from "./runs";
export { getQuests, claimQuest } from "./quests";
export { getAchievements } from "./achievements";
export { getDashboardStats } from "./stats";
