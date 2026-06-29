import { NextResponse } from "next/server";
import { getUser } from "@/lib/services/get-user";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const user = await getUser(userId);
        return NextResponse.json(user);
    } catch (err) {
        console.error("GET /api/user error:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch user";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
