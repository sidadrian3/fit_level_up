import { NextResponse } from "next/server";
import { getPaginatedWorkoutsFromDb } from "@/lib/data/workout-db";
import { logWorkout } from "@/lib/services/workouts/log-workout";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { CreateWorkoutSchema } from "@/lib/validations/schemas";
import { z } from "zod";
import { RateLimit } from "@/lib/auth/rate-limit";

export async function GET(request: Request) {
    try {
        const userId = await getAuthUserId();
        const { searchParams } = new URL(request.url);
        let limit = searchParams.has("limit") ? parseInt(searchParams.get("limit")!) : 5;
        if (isNaN(limit) || limit < 1) limit = 5;
        if (limit > 50) limit = 50; 
        
        const page = searchParams.has("page") ? parseInt(searchParams.get("page")!) : 1;
        const skip = (page - 1) * limit;
        
        const { data, totalCount } = await getPaginatedWorkoutsFromDb(userId, limit, skip);
        const totalPages = Math.ceil(totalCount / limit);
        
        return NextResponse.json({
            data,
            totalCount,
            totalPages,
            currentPage: page
        });
    } catch (err) {
        if(err instanceof Error && err.message === "Unauthorized"){
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        } 
        const message = err instanceof Error ? err.message : "Failed to fetch workouts";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthUserId();
        
        const { success } = await RateLimit.limit(userId);
        if (!success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await request.json();
        const parsed = CreateWorkoutSchema.parse(body);
        const workout = await logWorkout(parsed, userId);
        return NextResponse.json(workout, { status: 201 });
    } catch (err) {
        if(err instanceof Error && err.message === "Unauthorized"){
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
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
