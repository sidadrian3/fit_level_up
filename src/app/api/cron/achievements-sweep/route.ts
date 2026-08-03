import { NextResponse } from "next/server";
import { sweepLockedAchievements } from "@/lib/services/achievements/sweep-locked-achievements";

export const maxDuration = 300; // 5 minutes max duration for this cron job
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    // 1. Verify Vercel Cron Secret (if set)
    const authHeader = request.headers.get("authorization");
    if (
        process.env.CRON_SECRET &&
        authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        // 2. Run the sweep
        const result = await sweepLockedAchievements();
        return NextResponse.json(
            { success: true, ...result },
            { status: 200 }
        );
    } catch (error) {
        console.error("[Cron] Failed to sweep locked achievements:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
