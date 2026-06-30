import { NextResponse } from "next/server";
import { getAllWorkoutsFromDb } from "@/lib/data/workout-db";
import { logWorkout } from "@/lib/services/workouts/log-workout";
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
        const workout = await logWorkout(body, userId);
        return NextResponse.json(workout, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
