import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getAllWorkoutsFromDb } from "@/lib/data/workout-db";
import { getAllRunsFromDb } from "@/lib/data/runs-db";
import { calculatePersonalRecords } from "@/lib/utils";
import { handleApiError } from "@/lib/api/handle-api-error";

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
        return handleApiError(err);
    }
}
