import { getRunStats } from "@/server/training";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "runs.stats", auth: "user" }, ({ userId }) => getRunStats(userId));
