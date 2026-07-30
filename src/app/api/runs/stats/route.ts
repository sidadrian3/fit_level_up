import { NextResponse } from "next/server";
import { getAllRunsFromDb } from "@/lib/data/runs-db";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { calcRunStats } from "@/lib/utils";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        // Fetch all runs to calculate lifetime stats. 
        // Note: For a very large dataset, this could be moved to a MongoDB aggregation query.
        const runs = await getAllRunsFromDb(userId);
        const stats = calcRunStats(runs);
        return NextResponse.json(stats);
    } catch (err) {
        return handleApiError(err);
    }
}
