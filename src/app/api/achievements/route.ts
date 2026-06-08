import { NextResponse } from "next/server";
import { getAllAchievementsForUser } from "@/lib/data/achievements-db";

export async function GET() {
    try {
        const achievements = await getAllAchievementsForUser();
        return NextResponse.json(achievements);
    } catch (error) {
        console.error("Failed to fetch achievements:", error);
        return NextResponse.json(
            { error: "Failed to fetch achievements" },
            { status: 500 }
        );
    }
}
