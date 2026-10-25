import type { CreateWorkoutInput, Workout } from "@/lib/types";
import { recountQuestProgress, updateQuestProgress } from "@/server/quests";
import { getUserTimeZone } from "@/server/platform/auth";
import {
  getPlayerState,
  recordActivity,
  replaceSourceXp,
  revokeSource,
} from "@/server/progression";
import { clientPromise } from "@/server/platform/database";
import { emit } from "@/server/platform/events";
import { createOnce, type IdempotencyRequest, type IdempotentResult } from "@/server/platform/http";
import {
  calcWorkoutXP,
  evaluateWorkout,
  filterNamedExercises,
  validateWorkoutInput,
} from "./workout.rules";
import {
  deleteWorkoutById,
  findRecentWorkouts,
  findWorkoutByIdempotencyKey,
  findWorkoutDatesInRange,
  insertWorkout,
  listWorkoutsPage,
  updateWorkoutFields,
} from "./workout.repository";
import { activityDays, questMeasure } from "../training.adapters";

export async function logWorkout(
    input: CreateWorkoutInput,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<IdempotentResult<Workout>> {
    return createOnce({
        request: idempotency,
        findExisting: () => findWorkoutByIdempotencyKey(userId, idempotency.key),
        create: () => createWorkout(input, userId, idempotency),
        reusedMessage: "This workout was already saved with your earlier details. Check your history to edit it, or submit again to log a new one.",
    });
}

async function createWorkout(
    input: CreateWorkoutInput,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<Workout> {
    const client = await clientPromise;
    const session = client.startSession();
    try {
        return await session.withTransaction(async () => {
            const now = new Date();
            const player = await getPlayerState(userId, { now, session });
            const timeZone = await getUserTimeZone(userId, { session });

            const evaluation = evaluateWorkout(input, player.stamina);
            const workout = await insertWorkout({
                userId,
                title: input.title.trim(),
                exercises: evaluation.exercises,
                duration: input.duration,
                xpEarned: evaluation.finalXpEarned,
                date: now,
                idempotencyKey: idempotency.key,
                idempotencyFingerprint: idempotency.fingerprint,
            }, session);
            await emit("activity.logged", { userId, activity: { type: "workout", id: workout.id }, occurredAt: now }, { session });

            await updateQuestProgress(userId, {
                type: "workout_created",
                xpEarned: workout.xpEarned,
            }, { now, timeZone }, session);

            await recordActivity({
                userId,
                source: { type: "workout", id: workout.id },
                xp: workout.xpEarned,
                staminaCost: evaluation.staminaCost,
                totals: { workouts: 1 },
                occurredAt: now,
            }, session);

            return workout;
        });
    } finally {
        await session.endSession();
    }
}

export async function updateWorkout(id: string, input: CreateWorkoutInput, userId: string): Promise<Workout | null> {
    validateWorkoutInput(input);

    const exercises = filterNamedExercises(input.exercises);
    const xpEarned = calcWorkoutXP(input.duration, exercises.length);

    const client = await clientPromise;
    const session = client.startSession();
    try {
        return await session.withTransaction(async () => {
            const workout = await updateWorkoutFields(userId, id, {
                title: input.title.trim(),
                exercises,
                duration: input.duration,
                xpEarned,
            }, session);
            if (!workout) return null;

            await replaceSourceXp({
                userId,
                source: { type: "workout", id: workout.id },
                amount: workout.xpEarned,
                occurredAt: new Date(workout.date),
                totals: {},
            }, session);
            return workout;
        });
    } finally {
        await session.endSession();
    }
}

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

export function listWorkouts(userId: string, page: number, limit: number): Promise<{ data: Workout[]; totalCount: number }> {
    return listWorkoutsPage(userId, page, limit);
}

const MAX_RECENT_WORKOUTS = 3;

export function getRecentWorkouts(userId: string, limit: number = MAX_RECENT_WORKOUTS): Promise<Workout[]> {
    return findRecentWorkouts(userId, Math.min(limit, MAX_RECENT_WORKOUTS));
}

export function getWorkoutDatesInRange(userId: string, from: Date, toExclusive: Date): Promise<Date[]> {
    return findWorkoutDatesInRange(userId, from, toExclusive);
}
