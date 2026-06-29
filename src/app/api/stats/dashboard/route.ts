import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/services/get-dashboard-stats";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const stats = await getDashboardStats(userId);
        return NextResponse.json(stats);
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return NextResponse.json(
            { error: "Failed to fetch dashboard stats" },
            { status: 500 }
        );
    }
}
