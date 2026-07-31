import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/services/users/get-dashboard-stats";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { UserStateService } from "@/lib/services/users/user-state.service";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const user = await UserStateService.getUser(userId)
        const stats = await getDashboardStats(userId, user);
        return NextResponse.json(stats, {
            headers: { 'Cache-control': 'private, max-age=60, stale-while-revalidate=300' }
        });
    } catch (error) {
        return handleApiError(error);
    }
}
