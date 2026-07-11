import { NextResponse } from "next/server";
import { claimQuestReward } from "@/lib/services/quests/claim-quest-reward";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

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
        if(err instanceof Error && err.message === "Unauthorized"){
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if(err instanceof Error && err.message === "Quest not found"){
            return NextResponse.json({ error: "Quest not found" }, { status: 404 });
        }
        if(err instanceof Error && err.message === "Quest already claimed"){
            return NextResponse.json({ error: "Quest already claimed" }, { status: 400 });
        }
        if(err instanceof Error && err.message === "Quest not completed"){
            return NextResponse.json({ error: "Quest not completed" }, { status: 400 });
        }
        if(err instanceof Error && err.message === "Quest expired"){
            return NextResponse.json({ error: "Quest expired" }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : "Failed to claim quest";
        return NextResponse.json(
            { error: message },
            { status: 400 }
        );
    }
}