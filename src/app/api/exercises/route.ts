import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getCustomExercises } from "@/lib/services/exercises/get-custom-exercises";
import { createCustomExercise } from "@/lib/services/exercises/create-custom-exercise";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const customExercises = await getCustomExercises(userId);

        return NextResponse.json(customExercises);
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthUserId();
        const body = await request.json();
        const { name, targetMuscle } = body;

        // Domain validation and DB creation are now handled securely in the service layer
        const customExercise = await createCustomExercise(userId, name, targetMuscle);
        
        return NextResponse.json(customExercise, { status: 201 });

    } catch (error) {
        return handleApiError(error);
    }
}
