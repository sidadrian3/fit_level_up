import { NextResponse } from "next/server";
import { getUserFromDb } from "@/lib/data/user-db";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const user = await getUserFromDb(userId);
        return NextResponse.json(user);
    } catch (err) {
        console.error("GET /api/user error:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch user";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
