import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { sendFriendRequest } from "@/lib/services/friends/send-friend-request";
import { RateLimit } from "@/lib/auth/rate-limit";
import { SendFriendRequestSchema } from "@/lib/validations/schemas";
import { z } from "zod";
import { handleApiError } from "@/lib/api/handle-api-error";

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
        return handleApiError(err);
    }
}
