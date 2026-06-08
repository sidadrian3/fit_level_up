import { NextResponse } from "next/server";
import { getUserFromDb } from "@/lib/data/user-db";
import { DEMO_USER_ID } from "@/lib/constants/demo-user";

export async function GET() {
    try {
        const user = await getUserFromDb(DEMO_USER_ID);
        return NextResponse.json(user);
    } catch (err) {
        console.error("GET /api/user error:", err);
        return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
    }
}
