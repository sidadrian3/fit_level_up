import { NextResponse } from "next/server";
import { deleteWorkoutFromDb } from "@/lib/data/workout-db";

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
