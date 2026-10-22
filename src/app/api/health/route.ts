import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "health", auth: "public" }, async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
}));
