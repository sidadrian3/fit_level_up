import { formatDuration } from "@/lib/utils/formatters";
import type { PersonalRecord } from "@/lib/utils/records";

export const FIVE_K_WINDOW_KM = { min: 4.8, max: 5.2 } as const;
export const TEN_K_WINDOW_KM = { min: 9.8, max: 10.2 } as const;

const TOP_LIFT_COUNT = 3;

export type LiftMax = { name: string; weight: number };

export type RunRecordInputs = {
    longest: { distance: number } | null;
    fastest5k: { duration: number } | null;
    fastest10k: { duration: number } | null;
};

export function buildPersonalRecords(liftMaxes: readonly LiftMax[], runs: RunRecordInputs): PersonalRecord[] {
    const records: PersonalRecord[] = [...liftMaxes]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, TOP_LIFT_COUNT)
        .map((lift) => ({ label: lift.name, value: `${lift.weight} kg`, type: "strength" }));

    if (runs.fastest5k) {
        records.push({ label: "Fastest 5K", value: formatDuration(runs.fastest5k.duration), type: "cardio" });
    }
    if (runs.fastest10k) {
        records.push({ label: "Fastest 10K", value: formatDuration(runs.fastest10k.duration), type: "cardio" });
    }
    if (runs.longest) {
        records.push({ label: "Longest Run", value: `${runs.longest.distance} km`, type: "endurance" });
    }

    return records;
}
