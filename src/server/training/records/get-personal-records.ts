import type { PersonalRecord } from "@/shared/contracts/personal-record";
import { findLiftMaxes } from "../workouts/workout.repository";
import { findFastestRunInWindow, findLongestRun } from "../runs/run.repository";
import { buildPersonalRecords, FIVE_K_WINDOW_KM, TEN_K_WINDOW_KM, TOP_LIFT_COUNT } from "./records.rules";

export async function getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    const [liftMaxes, longest, fastest5k, fastest10k] = await Promise.all([
        findLiftMaxes(userId, TOP_LIFT_COUNT),
        findLongestRun(userId),
        findFastestRunInWindow(userId, FIVE_K_WINDOW_KM),
        findFastestRunInWindow(userId, TEN_K_WINDOW_KM),
    ]);
    return buildPersonalRecords(liftMaxes, { longest, fastest5k, fastest10k });
}
