import type { Workout, Run } from "@/lib/types";
import { formatDuration } from "./formatters";

export interface PersonalRecord {
    label: string;
    value: string;
    type: "strength" | "cardio" | "endurance";
}

export function calculatePersonalRecords(workouts: readonly Workout[], runs: readonly Run[]): PersonalRecord[] {
    const records: PersonalRecord[] = [];

    // --- 1. Strength (Top N Heaviest Exercises) ---
    const exerciseMaxes = new Map<string, { weight: number; originalName: string }>();

    for (const workout of workouts) {
        for (const exercise of workout.exercises) {
            if (exercise.weight !== null && exercise.weight > 0) {
                const normalized = exercise.name.trim().toLowerCase();
                if (!normalized) continue;
                
                const current = exerciseMaxes.get(normalized);
                if (!current || exercise.weight > current.weight) {
                    exerciseMaxes.set(normalized, {
                        weight: exercise.weight,
                        originalName: exercise.name.trim()
                    });
                }
            }
        }
    }

    const topLifts = Array.from(exerciseMaxes.values())
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3);

    for (const lift of topLifts) {
        records.push({
            label: lift.originalName,
            value: `${lift.weight} kg`,
            type: "strength"
        });
    }

    // --- 2. Cardio / Endurance (Runs) ---
    let maxDistanceRun: Run | null = null;
    let fastest5k: Run | null = null;
    let fastest10k: Run | null = null;

    for (const run of runs) {
        if (!maxDistanceRun || run.distance > maxDistanceRun.distance) {
            maxDistanceRun = run;
        }

        if (run.distance >= 4.8 && run.distance <= 5.2) {
            if (!fastest5k || run.duration < fastest5k.duration) {
                fastest5k = run;
            }
        }

        if (run.distance >= 9.8 && run.distance <= 10.2) {
            if (!fastest10k || run.duration < fastest10k.duration) {
                fastest10k = run;
            }
        }
    }

    if (fastest5k) {
        records.push({
            label: "Fastest 5K",
            value: formatDuration(fastest5k.duration),
            type: "cardio"
        });
    }

    if (fastest10k) {
        records.push({
            label: "Fastest 10K",
            value: formatDuration(fastest10k.duration),
            type: "cardio"
        });
    }

    if (maxDistanceRun) {
        records.push({
            label: "Longest Run",
            value: `${maxDistanceRun.distance} km`,
            type: "endurance"
        });
    }

    return records;
}
