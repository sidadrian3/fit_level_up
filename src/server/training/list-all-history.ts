// TEMPORARY stopgap removed in Task 9, when records, run stats and friends read through aggregations.
import { MAX_FIND_LIMIT } from "@/server/platform/database";
import type { Run, Workout } from "@/lib/types";
import { listWorkoutsPage } from "./workouts/workout.repository";
import { listRunsPage } from "./runs/run.repository";

async function listAllPages<T>(loadPage: (page: number) => Promise<{ data: T[]; totalCount: number }>): Promise<T[]> {
    const all: T[] = [];
    for (let page = 1; ; page++) {
        const { data, totalCount } = await loadPage(page);
        all.push(...data);
        if (data.length === 0 || all.length >= totalCount) return all;
    }
}

export function listAllWorkouts(userId: string): Promise<Workout[]> {
    return listAllPages((page) => listWorkoutsPage(userId, page, MAX_FIND_LIMIT));
}

export function listAllRuns(userId: string): Promise<Run[]> {
    return listAllPages((page) => listRunsPage(userId, page, MAX_FIND_LIMIT));
}
