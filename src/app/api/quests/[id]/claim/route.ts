import { NextResponse } from "next/server";
import { claimQuestRewardFromDb } from "@/lib/data/quests-db";
import { DEMO_USER_ID } from "@/lib/constants/demo-user";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await claimQuestRewardFromDb(
            DEMO_USER_ID,
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