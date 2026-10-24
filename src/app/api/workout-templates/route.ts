import { WorkoutTemplateSchema } from "@/shared/contracts/template";
import { createWorkoutTemplate, listTemplates } from "@/server/training";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "templates.list", auth: "user" }, ({ userId }) =>
  listTemplates(userId)
);

export const POST = defineRoute(
  { name: "templates.create", auth: "user", throttle: "standard", body: WorkoutTemplateSchema, status: 201, idempotency: "required" },
  ({ userId, body, idempotency }) => createWorkoutTemplate(body, userId, idempotency)
);
