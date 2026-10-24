import { listAllRuns } from "@/server/training";
import { calcRunStats } from "@/lib/utils";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "runs.stats", auth: "user" }, async ({ userId }) => {
  // Lifetime stats need every run; a very large dataset could move this into a Mongo aggregation.
  const runs = await listAllRuns(userId);
  return calcRunStats(runs);
});
