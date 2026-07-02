import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/services/users/get-dashboard-stats";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getUser } from "@/lib/services/users/get-user";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const user = await getUser(userId)
        const stats = await getDashboardStats(userId, user);
        return NextResponse.json(stats, {
            headers: { 'Cache-control': 'private, max-age=60, stale-while-revalidate=300' }
        });
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return NextResponse.json(
            { error: "Failed to fetch dashboard stats" },
            { status: 500 }
        );
    }
}
