import { NextResponse } from "next/server";
import { addWorkoutToDb, getAllWorkoutsFromDb } from "@/lib/data/workout-db";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const workouts = await getAllWorkoutsFromDb(userId);
        return NextResponse.json(workouts);
    } catch (err) {
        console.error("GET /api/workouts error:", err);
        return NextResponse.json({ error: "Failed to fetch workouts" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthUserId();
        const body = await request.json();
        const workout = await addWorkoutToDb(body, userId);
        return NextResponse.json(workout, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid request";
        // Assuming validation errors are thrown as Error objects with messages from workout-db
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
