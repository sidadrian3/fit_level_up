/**
 * Client-side API functions. Re-exports so imports like
 *   import { getRuns, getAchievements } from "@/lib/data/api-client"
 * keep working unchanged.
 */

export { ApiError, isIdempotencyKeyReused } from "@/lib/shared/api-fetch";
export { getAchievements } from "./achievements";
