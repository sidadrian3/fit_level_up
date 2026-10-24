import type { CreateWorkoutInput, Workout } from "@/lib/types";
import { clientPromise } from "@/server/platform/database";
import { replaceSourceXp } from "@/server/progression";
import { calcWorkoutXP, filterNamedExercises, validateWorkoutInput } from "./workout.rules";
import { updateWorkoutFields } from "./workout.repository";

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
