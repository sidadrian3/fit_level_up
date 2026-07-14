import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { declineFriendRequest } from "@/lib/services/friends/decline-friend-request";
import { RateLimit } from "@/lib/auth/rate-limit";

export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const userId = await getAuthUserId();
        
        const { success } = await RateLimit.limit(userId);
        if (!success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const friendship = await declineFriendRequest(params.id, userId);
        return NextResponse.json(friendship);
    } catch (err) {
        if (err instanceof Error && err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const message = err instanceof Error ? err.message : "Invalid request";
        let status = 400;
        if (message.includes("not found")) status = 404;
        if (message.includes("Not authorized")) status = 403;
        if (message.includes("not pending")) status = 409;
        return NextResponse.json({ error: message }, { status });
    }
}
