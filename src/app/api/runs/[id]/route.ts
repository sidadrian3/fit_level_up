import { deleteRunFromDb } from "@/lib/data/runs-db";
import { updateRun } from "@/lib/services/runs/update-run";
import { CreateRunSchema } from "@/shared/contracts/run";
import { NotFoundError, idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const PUT = defineRoute(
  { name: "runs.update", auth: "user", throttle: null, body: CreateRunSchema, params: idParams },
  async ({ userId, body, params }) => {
    const result = await updateRun(params.id, body, userId);
    if (!result) throw new NotFoundError("Run not found or invalid ID");
    return result;
  }
);

export const DELETE = defineRoute(
  { name: "runs.delete", auth: "user", throttle: null, body: null, params: idParams },
  async ({ userId, params }) => {
    const deleted = await deleteRunFromDb(params.id, userId);
    if (!deleted) throw new NotFoundError("Run not found or invalid ID");
    return { success: true };
  }
);
