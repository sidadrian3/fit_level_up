import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getFriendRequests } from "@/lib/services/friends/get-friend-requests";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const requests = await getFriendRequests(userId);
        return NextResponse.json(requests);
    } catch (err) {
        return handleApiError(err);
    }
}
