import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { removeFriend } from "@/lib/services/friends/remove-friend";
import { RateLimit } from "@/lib/auth/rate-limit";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = await getAuthUserId();
        
        const { success: rateLimitSuccess } = await RateLimit.limit(userId);
        if (!rateLimitSuccess) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const result = await removeFriend(id, userId);
        return NextResponse.json(result);
    } catch (err) {
        return handleApiError(err);
    }
}
