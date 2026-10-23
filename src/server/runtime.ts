import { Redis } from "@upstash/redis";
import { createDefineRoute, createRateLimiter } from "@/server/platform/http";
import { env } from "@/server/platform/env";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

// The lib auth seam keeps the route tests' existing auth mock effective.
export const defineRoute = createDefineRoute({
  requireUserId: getAuthUserId,
  limit: createRateLimiter(
    new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
  ),
});
