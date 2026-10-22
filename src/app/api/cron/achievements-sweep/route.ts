import { NextResponse } from "next/server";
import { sweepLockedAchievements } from "@/lib/services/achievements/sweep-locked-achievements";
import { handleApiError } from "@/lib/api/handle-api-error";
import { UnauthorizedError } from "@/server/platform/http";
import { env } from "@/server/platform/env";

export const maxDuration = 300; // 5 minutes max duration for this cron job
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
            throw new UnauthorizedError();
        }

        const result = await sweepLockedAchievements();
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return handleApiError(error);
    }
}
