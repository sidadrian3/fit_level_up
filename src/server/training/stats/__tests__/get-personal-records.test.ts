import { describe, it, expect, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import { getCollection } from "@/server/platform/database";
import { TargetMuscle } from "@/shared/contracts/exercise";
import { getPersonalRecords } from "../stats.service";

const userId = "personal-records-user";

function lift(name: string, weight: number | null) {
    return { name, targetMuscle: TargetMuscle.Chest, sets: 3, reps: 5, weight };
}

async function insertWorkouts(workouts: ReturnType<typeof lift>[][]) {
    await (await getCollection("workouts")).insertMany(
        workouts.map((exercises) => ({ _id: new ObjectId(), userId, title: "Session", exercises, duration: 45, xpEarned: 100, date: new Date() })),
    );
}

async function insertRuns(runs: { distance: number; duration: number }[]) {
    await (await getCollection("runs")).insertMany(
        runs.map((run) => ({ _id: new ObjectId(), userId, ...run, pace: run.duration / run.distance, difficulty: "moderate" as const, xpEarned: 50, date: new Date() })),
    );
}

describe("getPersonalRecords", () => {
    afterEach(async () => {
        await (await getCollection("workouts")).deleteMany({ userId });
        await (await getCollection("runs")).deleteMany({ userId });
    });

    it("finds the lifts beyond the first 200 workouts", async () => {
        const filler = Array.from({ length: 249 }, () => [lift("Curl", 10)]);
        await insertWorkouts([[lift("Deadlift", 200)], ...filler]);

        expect(await getPersonalRecords(userId)).toEqual([
            { label: "Deadlift", value: "200 kg", type: "strength" },
            { label: "Curl", value: "10 kg", type: "strength" },
        ]);
    });

    it("finds run records beyond the first 200 runs", async () => {
        const filler = Array.from({ length: 249 }, () => ({ distance: 2, duration: 20 }));
        await insertRuns([{ distance: 5, duration: 20 }, { distance: 10, duration: 50 }, { distance: 21, duration: 120 }, ...filler]);

        expect(await getPersonalRecords(userId)).toEqual([
            { label: "Fastest 5K", value: "20m", type: "cardio" },
            { label: "Fastest 10K", value: "50m", type: "cardio" },
            { label: "Longest Run", value: "21 km", type: "endurance" },
        ]);
    });

    it("shows the casing of the heaviest set, and the newest set among equal weights", async () => {
        await insertWorkouts([[lift("bench press", 80)], [lift("Bench Press ", 80)]]);

        expect(await getPersonalRecords(userId)).toEqual([{ label: "Bench Press", value: "80 kg", type: "strength" }]);
    });

    it("ranks equal-weight lifts by first appearance, newest workout first", async () => {
        await insertWorkouts([[lift("Row", 50)], [lift("Squat", 50), lift("Press", 50)], [lift("Curl", 50)], [lift("Deadlift", 90)]]);

        expect((await getPersonalRecords(userId)).map((record) => record.label)).toEqual(["Deadlift", "Curl", "Squat"]);
    });

    it("ignores unweighted and blank-named sets", async () => {
        await insertWorkouts([[lift("Plank", null), lift("Row", 0), lift("  ", 40)]]);

        expect(await getPersonalRecords(userId)).toEqual([]);
    });
});
