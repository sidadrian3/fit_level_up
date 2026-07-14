import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getFriendRequests } from "@/lib/services/friends/get-friend-requests";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const requests = await getFriendRequests(userId);
        return NextResponse.json(requests);
    } catch (err) {
        if (err instanceof Error && err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const message = err instanceof Error ? err.message : "Failed to fetch friend requests";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
