import type { ClientSession } from "mongodb";
import type { QuestMeasure } from "@/server/quests";
import { countRuns, sumRunDistance } from "./runs/run.repository";
import { countWorkouts } from "./workouts/workout.repository";

// run_distance is the raw sum: rounding here would let 14.96 km complete a 15 km quest.
export function questMeasure(userId: string, session: ClientSession): QuestMeasure {
  return (metric, range) => {
    switch (metric) {
      case "workout_count":
        return countWorkouts(userId, range, session);
      case "run_count":
        return countRuns(userId, range, session);
      case "run_distance":
        return sumRunDistance(userId, range, session);
    }
  };
}
