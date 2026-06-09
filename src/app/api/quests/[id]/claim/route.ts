import { NextResponse } from "next/server";
import { claimQuestRewardFromDb } from "@/lib/data/quests-db";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const userId = await getAuthUserId();

        await claimQuestRewardFromDb(
            userId,
            id
        );

        return NextResponse.json({
            success: true,
        });
    } catch (err) {
        const message =
            err instanceof Error
                ? err.message
                : "Failed to claim quest";

        return NextResponse.json(
            { error: message },
            { status: 400 }
        );
    }
}