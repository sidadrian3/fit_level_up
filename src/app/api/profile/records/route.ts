import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getAllWorkoutsFromDb } from "@/lib/data/workout-db";
import { getAllRunsFromDb } from "@/lib/data/runs-db";
import { calculatePersonalRecords } from "@/lib/utils";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        
        // Fetch all workouts and runs concurrently
        const [workouts, runs] = await Promise.all([
            getAllWorkoutsFromDb(userId),
            getAllRunsFromDb(userId)
        ]);

        // Calculate dynamic personal records
        const records = calculatePersonalRecords(workouts, runs);
        
        return NextResponse.json(records);
    } catch (err) {
        console.error("GET /api/profile/records error:", err);
        return NextResponse.json(
            { error: "Failed to fetch personal records" }, 
            { status: 500 }
        );
    }
}
