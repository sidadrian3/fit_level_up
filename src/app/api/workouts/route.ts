import { getPaginatedWorkoutsFromDb } from "@/lib/data/workout-db";
import { logWorkout } from "@/lib/services/workouts/log-workout";
import { CreateWorkoutSchema } from "@/shared/contracts/workout";
import { paginationQuery } from "@/shared/contracts/pagination";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute(
  { name: "workouts.list", auth: "user", query: paginationQuery },
  async ({ userId, query: { limit, page } }) => {
    const { data, totalCount } = await getPaginatedWorkoutsFromDb(userId, limit, (page - 1) * limit);
    return { data, totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: page };
  }
);

export const POST = defineRoute(
  { name: "workouts.create", auth: "user", throttle: "standard", body: CreateWorkoutSchema, status: 201, idempotency: "required" },
  ({ userId, body, idempotency }) => logWorkout(body, userId, idempotency)
);
