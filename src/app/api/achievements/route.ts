import { NextResponse } from "next/server";
import { listAchievements } from "@/server/achievements";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "achievements.list", auth: "user" }, async ({ userId }) => {
  const achievements = await listAchievements(userId);
  return NextResponse.json(achievements, {
    headers: { "Cache-control": "private, max-age=60, stale-while-revalidate=300" },
  });
});
