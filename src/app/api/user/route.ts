import { NextResponse } from "next/server";
import { UserStateService } from "@/lib/services/users/user-state.service";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const user = await UserStateService.getUser(userId);
        return NextResponse.json(user);
    } catch (err) {
        return handleApiError(err);
    }
}
