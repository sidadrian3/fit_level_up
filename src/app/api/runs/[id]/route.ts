import { deleteRun, updateRun } from "@/server/training";
import { CreateRunSchema } from "@/shared/contracts/run";
import { NotFoundError, idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const PUT = defineRoute(
  { name: "runs.update", auth: "user", throttle: "standard", body: CreateRunSchema, params: idParams },
  async ({ userId, body, params }) => {
    const result = await updateRun(params.id, body, userId);
    if (!result) throw new NotFoundError("Run not found or invalid ID");
    return result;
  }
);

export const DELETE = defineRoute(
  { name: "runs.delete", auth: "user", throttle: "standard", body: null, params: idParams },
  async ({ userId, params }) => {
    const deleted = await deleteRun(userId, params.id);
    if (!deleted) throw new NotFoundError("Run not found or invalid ID");
    return { success: true };
  }
);
