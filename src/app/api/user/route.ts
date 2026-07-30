import { NextResponse } from "next/server";
import { getUser } from "@/lib/services/users/get-user";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const user = await getUser(userId);
        return NextResponse.json(user);
    } catch (err) {
        return handleApiError(err);
    }
}
