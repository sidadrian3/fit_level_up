import { getAllRunsFromDb } from "@/lib/data/runs-db";
import { calcRunStats } from "@/lib/utils";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "runs.stats", auth: "user" }, async ({ userId }) => {
  // Lifetime stats need every run; a very large dataset could move this into a Mongo aggregation.
  const runs = await getAllRunsFromDb(userId);
  return calcRunStats(runs);
});
