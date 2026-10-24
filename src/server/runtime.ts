import { Redis } from "@upstash/redis";
import { createDispatcher, type AnyListener } from "@/server/platform/events";
import { createDefineRoute, createRateLimiter } from "@/server/platform/http";
import { env } from "@/server/platform/env";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

const LISTENERS: AnyListener[] = [];
const dispatcher = createDispatcher(LISTENERS);

export const drainOutbox = dispatcher.drainUntilEmpty;

// The lib auth seam keeps the route tests' existing auth mock effective.
export const defineRoute = createDefineRoute({
  requireUserId: getAuthUserId,
  limit: createRateLimiter(
    new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
  ),
  dispatchEvents: dispatcher.dispatchOwnAndOverdue,
});
