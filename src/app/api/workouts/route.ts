import { NextResponse } from "next/server";
import { addWorkout, getAllWorkouts } from "@/lib/data/workout-store";

export async function GET() {
    return NextResponse.json(getAllWorkouts());
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const workout = addWorkout(body);
        return NextResponse.json(workout, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
