import { listRuns, logRun } from "@/server/training";
import { CreateRunSchema } from "@/shared/contracts/run";
import { paginationQuery } from "@/shared/contracts/pagination";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute(
  { name: "runs.list", auth: "user", query: paginationQuery },
  async ({ userId, query: { limit, page } }) => {
    const { data, totalCount } = await listRuns(userId, page, limit);
    return { data, totalCount, totalPages: Math.ceil(totalCount / limit), currentPage: page };
  }
);

export const POST = defineRoute(
  { name: "runs.create", auth: "user", throttle: "standard", body: CreateRunSchema, status: 201, idempotency: "required" },
  ({ userId, body, idempotency }) => logRun(body, userId, idempotency)
);
