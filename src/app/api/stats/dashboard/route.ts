import { NextResponse } from "next/server";
import { getDashboardStatsFromDb } from "@/lib/data/stats-db";

export async function GET() {
    try {
        const stats = await getDashboardStatsFromDb();
        return NextResponse.json(stats);
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return NextResponse.json(
            { error: "Failed to fetch dashboard stats" },
            { status: 500 }
        );
    }
}
