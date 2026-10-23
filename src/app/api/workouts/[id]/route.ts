import { deleteWorkoutFromDb } from "@/lib/data/workout-db";
import { updateWorkout } from "@/lib/services/workouts/update-workout";
import { CreateWorkoutSchema } from "@/shared/contracts/workout";
import { NotFoundError, idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const PUT = defineRoute(
  { name: "workouts.update", auth: "user", throttle: "standard", body: CreateWorkoutSchema, params: idParams },
  async ({ userId, body, params }) => {
    const result = await updateWorkout(params.id, body, userId);
    if (!result) throw new NotFoundError("Workout not found or invalid ID");
    return result;
  }
);

export const DELETE = defineRoute(
  { name: "workouts.delete", auth: "user", throttle: "standard", body: null, params: idParams },
  async ({ userId, params }) => {
    const deleted = await deleteWorkoutFromDb(params.id, userId);
    if (!deleted) throw new NotFoundError("Workout not found or invalid ID");
    return { success: true };
  }
);
