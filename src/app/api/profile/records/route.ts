import { listAllRuns, listAllWorkouts } from "@/server/training";
import { calculatePersonalRecords } from "@/lib/utils";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "profile.records", auth: "user" }, async ({ userId }) => {
  const [workouts, runs] = await Promise.all([listAllWorkouts(userId), listAllRuns(userId)]);
  return calculatePersonalRecords(workouts, runs);
});
