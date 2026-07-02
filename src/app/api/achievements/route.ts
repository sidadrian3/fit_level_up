import { NextResponse } from "next/server";
import { getAllAchievementsForUser } from "@/lib/data/achievements-db";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const achievements = await getAllAchievementsForUser(userId);
        return NextResponse.json(achievements, {
            headers: { 'Cache-control': 'private, max-age=60, stale-while-revalidate=300' }
        });
    } catch (error) {
        console.error("Failed to fetch achievements:", error);
        return NextResponse.json(
            { error: "Failed to fetch achievements" },
            { status: 500 }
        );
    }
}
