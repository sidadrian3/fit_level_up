import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/services/users/get-dashboard-stats";
import { getUser } from "@/lib/services/users/get-user";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "stats.dashboard", auth: "user" }, async ({ userId }) => {
  const user = await getUser(userId);
  const stats = await getDashboardStats(userId, user);
  return NextResponse.json(stats, {
    headers: { "Cache-control": "private, max-age=60, stale-while-revalidate=300" },
  });
});
