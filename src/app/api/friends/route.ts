import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getFriends } from "@/lib/services/friends/get-friends";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const friends = await getFriends(userId);
        return NextResponse.json(friends);
    } catch (err) {
        if (err instanceof Error && err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const message = err instanceof Error ? err.message : "Failed to fetch friends";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
