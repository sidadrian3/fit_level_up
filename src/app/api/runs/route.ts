import { NextResponse } from "next/server";
import { getPaginatedRunsFromDb } from "@/lib/data/runs-db";
import { logRun } from "@/lib/services/runs/log-run";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { CreateRunSchema } from "@/lib/validations/schemas";
import { z } from "zod";

export async function GET(request: Request) {
    try {
        const userId = await getAuthUserId();
        const { searchParams } = new URL(request.url);
        const limit = searchParams.has("limit") ? parseInt(searchParams.get("limit")!) : 5;
        const page = searchParams.has("page") ? parseInt(searchParams.get("page")!) : 1;
        const skip = (page - 1) * limit;

        const { data, totalCount } = await getPaginatedRunsFromDb(userId, limit, skip);
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
        const message = err instanceof Error ? err.message : "Failed to fetch runs";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthUserId();
        const body = await request.json();
        const parsed = CreateRunSchema.parse(body);
        const run = await logRun(parsed, userId);
        return NextResponse.json(run, { status: 201 });
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
