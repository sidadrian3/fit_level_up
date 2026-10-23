import { getAllWorkoutsFromDb } from "@/lib/data/workout-db";
import { getAllRunsFromDb } from "@/lib/data/runs-db";
import { calculatePersonalRecords } from "@/lib/utils";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "profile.records", auth: "user" }, async ({ userId }) => {
  const [workouts, runs] = await Promise.all([getAllWorkoutsFromDb(userId), getAllRunsFromDb(userId)]);
  return calculatePersonalRecords(workouts, runs);
});
