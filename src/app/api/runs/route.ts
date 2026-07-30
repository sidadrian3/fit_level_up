import { NextResponse } from "next/server";
import { getPaginatedRunsFromDb } from "@/lib/data/runs-db";
import { logRun } from "@/lib/services/runs/log-run";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { CreateRunSchema } from "@/lib/validations/schemas";
import { z } from "zod";
import { RateLimit } from "@/lib/auth/rate-limit";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function GET(request: Request) {
    try {
        const userId = await getAuthUserId();
        const { searchParams } = new URL(request.url);
        let limit = searchParams.has("limit") ? parseInt(searchParams.get("limit")!) : 5;
        if (isNaN(limit) || limit < 1) limit = 5;
        if (limit > 50) limit = 50; 
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
        return handleApiError(err);
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
        const parsed = CreateRunSchema.parse(body);
        const run = await logRun(parsed, userId);
        return NextResponse.json(run, { status: 201 });
    } catch (err) {
        return handleApiError(err);
    }
}
