/**
 * Client-side API functions. Re-exports so imports like
 *   import { getWorkouts, getUser } from "@/lib/data/api-client"
 * keep working unchanged.
 */

export { getUser } from "./user";
export { getWorkouts, createWorkout, deleteWorkout, updateWorkout } from "./workouts";
export { getRuns, createRun, deleteRun, updateRun, getRunStats } from "./runs";
export { getQuests, claimQuest } from "./quests";
export { getAchievements } from "./achievements";
export { getDashboardStats, getPersonalRecords } from "./stats";
export { createCustomExercise, fetchCustomExercises } from "./exercises";
