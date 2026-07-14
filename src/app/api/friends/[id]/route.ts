import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { removeFriend } from "@/lib/services/friends/remove-friend";
import { RateLimit } from "@/lib/auth/rate-limit";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const userId = await getAuthUserId();
        
        const { success } = await RateLimit.limit(userId);
        if (!success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const result = await removeFriend(params.id, userId);
        return NextResponse.json(result);
    } catch (err) {
        if (err instanceof Error && err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const message = err instanceof Error ? err.message : "Invalid request";
        const status = message.includes("not found") ? 404 : (message.includes("Not authorized") ? 403 : 400);
        return NextResponse.json({ error: message }, { status });
    }
}
