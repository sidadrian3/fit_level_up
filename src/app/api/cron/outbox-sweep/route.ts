import { defineRoute, drainOutbox } from "@/server/runtime";

export const maxDuration = 300; // 5 minutes max duration for this cron job
export const dynamic = "force-dynamic";

export const GET = defineRoute({ name: "cron.outbox-sweep", auth: "cron" }, () => drainOutbox());
