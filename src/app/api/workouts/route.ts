import { NextResponse } from "next/server";
import { getAllWorkoutsFromDb } from "@/lib/data/workout-db";
import { logWorkout } from "@/lib/services/workouts/log-workout";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { CreateWorkoutSchema } from "@/lib/validations/schemas";
import { z } from "zod";

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
        const parsed = CreateWorkoutSchema.parse(body);
        const workout = await logWorkout(parsed, userId);
        return NextResponse.json(workout, { status: 201 });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return NextResponse.json(
                { error: err.issues[0]?.message ?? "Invalid input" },
                { status: 400 }
            );
        }
        const message = err instanceof Error ? err.message : "Invalid request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
