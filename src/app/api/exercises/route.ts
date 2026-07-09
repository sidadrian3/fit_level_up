import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getCustomExercises } from "@/lib/services/exercises/get-custom-exercises";
import { createCustomExercise } from "@/lib/services/exercises/create-custom-exercise";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const customExercises = await getCustomExercises(userId);

        return NextResponse.json(customExercises);
    } catch (error) {
        console.error("Error fetching user custom exercises:", error);
        return NextResponse.json({ error: "Failed to fetch user custom exercises" }, { status: 500 });
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
        console.error("Error creating custom exercise:", error);
        
        // If the error was thrown by our domain logic (e.g. duplicates), send a 400
        if (error instanceof Error && error.message.includes("already created")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to create custom exercise" }, { status: 500 });
    }
}
