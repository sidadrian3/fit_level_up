import { NextResponse } from "next/server";
import { deleteWorkoutFromDb } from "@/lib/data/workout-db";
import { updateWorkout } from "@/lib/services/workouts/update-workout";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { CreateWorkoutSchema } from "@/lib/validations/schemas";
import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthUserId();
        const { id } = await params;
        const body = await request.json();
        const parsed = CreateWorkoutSchema.parse(body);
        const result = await updateWorkout(id, parsed, userId);

        if (!result) {
            return NextResponse.json(
                { error: "Workout not found or invalid ID" },
                { status: 404 }
            );
        }

        return NextResponse.json(result, { status: 200 });
    } catch (err) {
        return handleApiError(err);
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthUserId();
        const { id } = await params;
        const success = await deleteWorkoutFromDb(id, userId);

        if (!success) {
            return NextResponse.json(
                { error: "Workout not found or invalid ID" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
        return handleApiError(err);
    }
}
