import {NextResponse} from "next/server";
import  { getUserQuests } from "@/lib/services/get-user-quests";
import { getAuthUserId } from "@/lib/auth/auth-helpers";


export async function GET() {
    try{
        const userId = await getAuthUserId();
        const quests = await getUserQuests(userId);
        return NextResponse.json(quests);
    } catch (error) {
        console.error("Error fetching user quests:", error);
        return NextResponse.json({ error: "Failed to fetch user quests" }, { status: 500 });
    }
}
