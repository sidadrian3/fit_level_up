import { clientPromise } from "@/server/platform/database";
import { emit } from "@/server/platform/events";
import { getUserTimeZone } from "@/server/platform/auth";
import { revokeSource } from "@/server/progression";
import { recountQuestProgress } from "@/server/quests";
import { activityDays, questMeasure } from "../training.adapters";
import { deleteWorkoutById } from "./workout.repository";

export async function deleteWorkout(
  userId: string,
  workoutId: string,
): Promise<boolean> {
  const client = await clientPromise;
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const workout = await deleteWorkoutById(userId, workoutId, session);
      if (!workout) return false;

      const occurredAt = new Date(workout.date);
      const timeZone = await getUserTimeZone(userId, { session });
      await revokeSource(
        {
          userId,
          source: { type: "workout", id: workout.id },
          occurredAt,
          totals: { workouts: -1 },
          activityDays: activityDays(userId, timeZone, session),
        },
        session,
      );
      await recountQuestProgress(
        userId,
        {
          metrics: ["workout_count"],
          occurredAt,
          timeZone,
          measure: questMeasure(userId, session),
        },
        session,
      );
      await emit(
        "activity.reverted",
        { userId, activity: { type: "workout", id: workout.id } },
        { session },
      );
      return true;
    });
  } finally {
    await session.endSession();
  }
}
