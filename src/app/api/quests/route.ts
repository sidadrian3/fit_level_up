import {NextResponse} from "next/server";
import  { getUserQuests } from "@/lib/services/quests/get-user-quests";
import { getAuthUserId } from "@/lib/auth/auth-helpers";


export async function GET() {
    try{
        const userId = await getAuthUserId();
        const quests = await getUserQuests(userId);
        return NextResponse.json(quests);
    } catch (err) {
        if(err instanceof Error && err.message === "Unauthorized"){
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const message = err instanceof Error ? err.message : "Failed to fetch user quests";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
