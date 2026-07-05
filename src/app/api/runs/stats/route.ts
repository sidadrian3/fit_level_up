import { NextResponse } from "next/server";
import { getAllRunsFromDb } from "@/lib/data/runs-db";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { calcRunStats } from "@/lib/utils";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        // Fetch all runs to calculate lifetime stats. 
        // Note: For a very large dataset, this could be moved to a MongoDB aggregation query.
        const runs = await getAllRunsFromDb(userId);
        const stats = calcRunStats(runs);
        return NextResponse.json(stats);
    } catch (err) {
        console.error("GET /api/runs/stats error:", err);
        return NextResponse.json({ error: "Failed to fetch run stats" }, { status: 500 });
    }
}
