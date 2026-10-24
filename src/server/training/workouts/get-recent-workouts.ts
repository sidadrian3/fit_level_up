import type { Workout } from "@/lib/types";
import { findRecentWorkouts } from "./workout.repository";

const MAX_RECENT_WORKOUTS = 3;

export function getRecentWorkouts(userId: string, limit: number = MAX_RECENT_WORKOUTS): Promise<Workout[]> {
    return findRecentWorkouts(userId, Math.min(limit, MAX_RECENT_WORKOUTS));
}
