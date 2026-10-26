/**
 * Client-side API functions. Re-exports so imports like
 *   import { getWorkouts, getRuns } from "@/lib/data/api-client"
 * keep working unchanged.
 */

export { ApiError, isIdempotencyKeyReused } from "@/lib/shared/api-fetch";
export { getWorkouts, createWorkout, deleteWorkout, updateWorkout } from "./workouts";
export { getRuns, createRun, deleteRun, updateRun, getRunStats } from "./runs";
export { getAchievements } from "./achievements";
export { getDashboardStats, getPersonalRecords } from "./stats";
