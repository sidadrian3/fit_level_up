import { NextResponse } from "next/server";
import { deleteWorkoutFromDb, updateWorkoutInDb } from "@/lib/data/workout-db";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const result = await updateWorkoutInDb(id, body);

        if (!result) {
            return NextResponse.json(
                { error: "Workout not found or invalid ID" },
                { status: 404 }
            );
        }

        return NextResponse.json(result, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid request";
        console.error("PUT /api/workouts/[id] error:", err);
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const success = await deleteWorkoutFromDb(id);

        if (!success) {
            return NextResponse.json(
                { error: "Workout not found or invalid ID" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
        console.error("DELETE /api/workouts/[id] error:", err);
        return NextResponse.json(
            { error: "Failed to delete workout" },
            { status: 500 }
        );
    }
}
