import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { sendFriendRequest } from "@/lib/services/friends/send-friend-request";
import { RateLimit } from "@/lib/auth/rate-limit";
import { SendFriendRequestSchema } from "@/lib/validations/schemas";
import { z } from "zod";

export async function POST(request: Request) {
    try {
        const userId = await getAuthUserId();
        
        const { success } = await RateLimit.limit(userId);
        if (!success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await request.json();
        const parsed = SendFriendRequestSchema.parse(body);
        
        const friendship = await sendFriendRequest(userId, parsed.receiverId);
        return NextResponse.json(friendship, { status: 201 });
    } catch (err) {
        if (err instanceof Error && err.message === "Unauthorized") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : "Invalid request";
        const status = message.includes("User not found") ? 404 : (message.includes("already sent") ? 409 : 400);
        return NextResponse.json({ error: message }, { status });
    }
}
