import { NextResponse } from "next/server";
import { addWorkoutToDb, getAllWorkoutsFromDb } from "@/lib/data/workout-db";

export async function GET() {
    try {
        const workouts = await getAllWorkoutsFromDb();
        return NextResponse.json(workouts);
    } catch (err) {
        console.error("GET /api/workouts error:", err);
        return NextResponse.json({ error: "Failed to fetch workouts" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const workout = await addWorkoutToDb(body);
        return NextResponse.json(workout, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid request";
        // Assuming validation errors are thrown as Error objects with messages from workout-db
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
