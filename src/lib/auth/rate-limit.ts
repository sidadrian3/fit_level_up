import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const RateLimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    analytics: true,
})