import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { declineFriendRequest } from "@/lib/services/friends/decline-friend-request";
import { RateLimit } from "@/lib/auth/rate-limit";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getAuthUserId();
        
        const { success } = await RateLimit.limit(userId);
        if (!success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const friendship = await declineFriendRequest(id, userId);
        return NextResponse.json(friendship);
    } catch (err) {
        return handleApiError(err);
    }
}
