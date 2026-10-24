import { aggregateRunStats } from "../runs/run.repository";

export type RunStats = { totalKm: number; totalRuns: number; avgPace: number };

export async function getRunStats(userId: string): Promise<RunStats> {
    const totals = await aggregateRunStats(userId);
    if (!totals) return { totalKm: 0, totalRuns: 0, avgPace: 0 };

    return {
        totalKm: parseFloat(totals.totalDistance.toFixed(1)),
        totalRuns: totals.totalRuns,
        avgPace: parseFloat((totals.totalPace / totals.totalRuns).toFixed(2)),
    };
}
