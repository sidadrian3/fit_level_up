import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";
import { WorkoutTemplateSchema } from "@/lib/validations/schemas";
import { getWorkoutTemplatesFromDb} from "@/lib/data/workout-templates-db";
import { createWorkoutTemplate } from "@/lib/services/workout-templates/create-workout-template";

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

        const template = await createWorkoutTemplate(input, userId);

        return NextResponse.json(template, {status: 201});
    }catch(err){
        return handleApiError(err);
    }
};