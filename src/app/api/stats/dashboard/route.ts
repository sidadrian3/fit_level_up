import { NextResponse } from "next/server";
import { getDashboardStats } from "@/server/training";
import { countUnlockedAchievements } from "@/server/achievements";
import { getUser } from "@/server/progression";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "stats.dashboard", auth: "user" }, async ({ userId }) => {
  const user = await getUser(userId);
  const stats = await getDashboardStats(userId, user, { countAchievements: countUnlockedAchievements });
  return NextResponse.json(stats, {
    headers: { "Cache-control": "private, max-age=60, stale-while-revalidate=300" },
  });
});
