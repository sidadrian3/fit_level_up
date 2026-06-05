import {NextResponse} from "next/server";
import  { getUserQuestsFromDb } from "@/lib/data/quests-db";

const DEMO_USER_ID = "demo-user";

export async function GET() {
    try{
        const quests = await getUserQuestsFromDb(DEMO_USER_ID);
        return NextResponse.json(quests);
    } catch (error) {
        console.error("Error fetching user quests:", error);
        return NextResponse.json({ error: "Failed to fetch user quests" }, { status: 500 });
    }
}
