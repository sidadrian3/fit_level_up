import { NextResponse } from "next/server";
import { getAllRunsFromDb, addRunToDb } from "@/lib/data/runs-db";

export async function GET() {
    try {
        const runs = await getAllRunsFromDb();
        return NextResponse.json(runs);
    } catch (err) {
        console.error("GET /api/runs error:", err);
        return NextResponse.json({ error: "Failed to fetch runs" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try{
        const body = await request.json();
        const run = await addRunToDb(body);
        return NextResponse.json(run, { status: 201 });
    }catch (err) {
        const message = err instanceof Error ? err.message : "Invalid request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

