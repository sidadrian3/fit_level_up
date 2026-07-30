import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getFriends } from "@/lib/services/friends/get-friends";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const friends = await getFriends(userId);
        return NextResponse.json(friends);
    } catch (err) {
        return handleApiError(err);
    }
}
