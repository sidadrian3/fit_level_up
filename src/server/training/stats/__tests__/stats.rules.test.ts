import { describe, it, expect } from "vitest";
import { buildPersonalRecords, FIVE_K_WINDOW_KM, TEN_K_WINDOW_KM } from "../stats.rules";

const noRuns = { longest: null, fastest5k: null, fastest10k: null };

describe("buildPersonalRecords", () => {
    it("returns nothing for empty inputs", () => {
        expect(buildPersonalRecords([], noRuns)).toEqual([]);
    });

    it("keeps the top three lifts by weight using their display names", () => {
        const records = buildPersonalRecords(
            [
                { name: "Curl", weight: 20 },
                { name: "Deadlift", weight: 180 },
                { name: "Bench Press", weight: 100 },
                { name: "Squat", weight: 140 },
            ],
            noRuns,
        );

        expect(records).toEqual([
            { label: "Deadlift", value: "180 kg", type: "strength" },
            { label: "Squat", value: "140 kg", type: "strength" },
            { label: "Bench Press", value: "100 kg", type: "strength" },
        ]);
    });

    it("appends 5K, 10K and longest run records after the lifts", () => {
        const records = buildPersonalRecords([{ name: "Squat", weight: 100 }], {
            longest: { distance: 12.5 },
            fastest5k: { duration: 25 },
            fastest10k: { duration: 55 },
        });

        expect(records.map((r) => [r.label, r.type])).toEqual([
            ["Squat", "strength"],
            ["Fastest 5K", "cardio"],
            ["Fastest 10K", "cardio"],
            ["Longest Run", "endurance"],
        ]);
        expect(records[3].value).toBe("12.5 km");
    });

    it("exposes the distance windows used to qualify 5K and 10K runs", () => {
        expect(FIVE_K_WINDOW_KM).toEqual({ min: 4.8, max: 5.2 });
        expect(TEN_K_WINDOW_KM).toEqual({ min: 9.8, max: 10.2 });
    });
});
