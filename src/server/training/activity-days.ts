import type { ClientSession } from "mongodb";
import type { ActivityDays } from "@/server/progression";
import { startOfLocalDay, toLocalDay } from "@/shared/time/calendar";
import * as runRepository from "./runs/run.repository";
import * as workoutRepository from "./workouts/workout.repository";

export function activityDays(userId: string, timeZone: string, session: ClientSession): ActivityDays {
  return {
    async since(fromDay) {
      const from = startOfLocalDay(fromDay, timeZone);
      const workoutDays = await workoutRepository.findActivityDaysSince(userId, from, timeZone, session);
      const runDays = await runRepository.findActivityDaysSince(userId, from, timeZone, session);
      return [...new Set([...workoutDays, ...runDays])];
    },
    async latest() {
      const workoutDate = await workoutRepository.findLatestDate(userId, session);
      const runDate = await runRepository.findLatestDate(userId, session);
      const dates = [workoutDate, runDate].filter((date): date is Date => date !== null);
      if (dates.length === 0) return null;
      return toLocalDay(new Date(Math.max(...dates.map((date) => date.getTime()))), timeZone);
    },
  };
}
