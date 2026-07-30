import { NextResponse } from "next/server";
import { getAllAchievementsForUser } from "@/lib/data/achievements-db";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function GET() {
    try {
        const userId = await getAuthUserId();
        const achievements = await getAllAchievementsForUser(userId);
        return NextResponse.json(achievements, {
            headers: { 'Cache-control': 'private, max-age=60, stale-while-revalidate=300' }
        });
    } catch (error) {
        return handleApiError(error);
    }
}
