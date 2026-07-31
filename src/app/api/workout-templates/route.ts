import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";
import { WorkoutTemplateSchema } from "@/lib/validations/schemas";
import { getWorkoutTemplatesFromDb, createWorkoutTemplateInDb } from "@/lib/data/workout-templates-db";

export async function GET(){
    try{
        const userId = await getAuthUserId();
        const templates = await getWorkoutTemplatesFromDb(userId);
        return NextResponse.json(templates);
    }catch (err){
        return handleApiError(err);
    }
}

export async function POST(req: Request){
    try{
        const userId = await getAuthUserId();
        const body = await req.json();
        const input = WorkoutTemplateSchema.parse(body);

        const template = await createWorkoutTemplateInDb({
            userId,
            name: input.name,
            exercises: input.exercises,
            idempotencyKey: input.idempotencyKey,
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json(template, {status: 201});
    }catch(err){
        return handleApiError(err);
    }
};