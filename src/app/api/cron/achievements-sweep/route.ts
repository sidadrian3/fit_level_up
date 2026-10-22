import { sweepLockedAchievements } from "@/lib/services/achievements/sweep-locked-achievements";
import { defineRoute } from "@/server/runtime";

export const maxDuration = 300; // 5 minutes max duration for this cron job
export const dynamic = "force-dynamic";

export const GET = defineRoute({ name: "cron.achievements-sweep", auth: "cron" }, async () => {
  const result = await sweepLockedAchievements();
  return { success: true, ...result };
});
