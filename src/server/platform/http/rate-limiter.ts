import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import { RATE_LIMIT_TIERS } from "@/server/platform/config";
import type { RateLimitResult, ThrottleTier } from "./define-route";

const LIMITER_TIMEOUT_MS = 1000;

export function createRateLimiter(redis: Redis) {
  const limiters = Object.fromEntries(
    Object.entries(RATE_LIMIT_TIERS).map(([tier, { requests, window }]) => [
      tier,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window),
        prefix: `rl:${tier}`,
        timeout: LIMITER_TIMEOUT_MS,
      }),
    ])
  ) as Record<ThrottleTier, Ratelimit>;

  return (tier: ThrottleTier, identifier: string): Promise<RateLimitResult> =>
    limiters[tier].limit(identifier);
}
