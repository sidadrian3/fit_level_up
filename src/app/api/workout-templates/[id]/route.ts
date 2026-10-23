import { deleteWorkoutTemplateFromDb } from "@/lib/data/workout-templates-db";
import { NotFoundError, idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const DELETE = defineRoute(
  { name: "templates.delete", auth: "user", throttle: "standard", body: null, params: idParams },
  async ({ userId, params }) => {
    const deleted = await deleteWorkoutTemplateFromDb(userId, params.id);
    if (!deleted) throw new NotFoundError("Template not found");
    return { success: true };
  }
);
