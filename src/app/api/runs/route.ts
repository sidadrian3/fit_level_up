import { NextResponse } from "next/server";
import { getAllRunsFromDb } from "@/lib/data/runs-db";
import { logRun } from "@/lib/services/runs/log-run";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const runs = await getAllRunsFromDb(userId);
        return NextResponse.json(runs);
    } catch (err) {
        console.error("GET /api/runs error:", err);
        return NextResponse.json({ error: "Failed to fetch runs" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthUserId();
        const body = await request.json();
        const run = await logRun(body, userId);
        return NextResponse.json(run, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
