import { WorkoutTemplateSchema } from "@/shared/contracts/template";
import { getWorkoutTemplatesFromDb } from "@/lib/data/workout-templates-db";
import { createWorkoutTemplate } from "@/lib/services/workout-templates/create-workout-template";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "templates.list", auth: "user" }, ({ userId }) =>
  getWorkoutTemplatesFromDb(userId)
);

export const POST = defineRoute(
  { name: "templates.create", auth: "user", throttle: "standard", body: WorkoutTemplateSchema, status: 201, idempotency: "required" },
  ({ userId, body, idempotency }) => createWorkoutTemplate(body, userId, idempotency)
);
