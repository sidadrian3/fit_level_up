import { Redis } from "@upstash/redis";
import { createDispatcher } from "@/server/platform/events";
import { createDefineRoute, createRateLimiter } from "@/server/platform/http";
import { env } from "@/server/platform/env";
import { requireSessionUserId } from "@/server/platform/auth";
import { achievementListeners } from "@/server/achievements";
import { notificationListeners } from "@/server/notification";

const LISTENERS = [...achievementListeners, ...notificationListeners];
const dispatcher = createDispatcher(LISTENERS);

export const drainOutbox = dispatcher.drainUntilEmpty;

export const defineRoute = createDefineRoute({
  requireUserId: requireSessionUserId,
  limit: createRateLimiter(
    new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
  ),
  dispatchEvents: dispatcher.dispatchOwnAndOverdue,
});
