import { NextResponse } from "next/server";
import { claimQuestReward } from "@/lib/services/quests/claim-quest-reward";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const userId = await getAuthUserId();

        await claimQuestReward(userId, id);

        return NextResponse.json({
            success: true,
        });
    } catch (err) {
        return handleApiError(err);
    }
}