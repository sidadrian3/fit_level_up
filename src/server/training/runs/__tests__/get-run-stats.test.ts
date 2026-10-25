import { describe, it, expect, afterEach } from "vitest";
import { getCollection } from "@/server/platform/database";
import { getRunStats } from "../run.service";

const userId = "run-stats-user";

describe("getRunStats", () => {
    afterEach(async () => {
        await (await getCollection("runs")).deleteMany({ userId });
    });

    it("covers the whole history, not just the first 200 runs", async () => {
        const run = { userId, distance: 2, duration: 12, pace: 6, difficulty: "moderate" as const, xpEarned: 50, date: new Date() };
        await (await getCollection("runs")).insertMany(Array.from({ length: 250 }, () => ({ ...run })));

        expect(await getRunStats(userId)).toEqual({ totalKm: 500, totalRuns: 250, avgPace: 6 });
    });
});
