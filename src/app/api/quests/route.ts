import {NextResponse} from "next/server";
import  { getUserQuests } from "@/lib/services/quests/get-user-quests";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { handleApiError } from "@/lib/api/handle-api-error";


export async function GET() {
    try{
        const userId = await getAuthUserId();
        const quests = await getUserQuests(userId);
        return NextResponse.json(quests);
    } catch (err) {
        return handleApiError(err);
    }
}
