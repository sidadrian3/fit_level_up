import type { Workout } from "@/lib/types";
import { listWorkoutsPage } from "./workout.repository";

export function listWorkouts(userId: string, page: number, limit: number): Promise<{ data: Workout[]; totalCount: number }> {
    return listWorkoutsPage(userId, page, limit);
}
