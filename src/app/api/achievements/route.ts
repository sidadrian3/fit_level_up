import { NextResponse } from "next/server";
import { getAllAchievementsForUser } from "@/lib/data/achievements-db";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "achievements.list", auth: "user" }, async ({ userId }) => {
  const achievements = await getAllAchievementsForUser(userId);
  return NextResponse.json(achievements, {
    headers: { "Cache-control": "private, max-age=60, stale-while-revalidate=300" },
  });
});
