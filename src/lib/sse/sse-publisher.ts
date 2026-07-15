import { Redis } from "@upstash/redis";
import type { SSEEvent } from "./sse-types";

/**
 * Creates an Upstash Redis client.
 * Uses Redis.fromEnv() which reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * — the same env vars already used by the rate limiter.
 */
function getRedis(): Redis {
  return Redis.fromEnv();
}

/**
 * The Redis key prefix for per-user SSE message queues.
 * Each user gets a list at key "sse:{userId}".
 */
const SSE_KEY_PREFIX = "sse:";

/**
 * How long (in seconds) a message queue lives before Redis auto-deletes it.
 * If a user is offline, stale messages expire rather than piling up forever.
 */
const SSE_QUEUE_TTL_SECONDS = 60;

/**
 * Push an SSE event into a user's Redis message queue.
 *
 * Any serverless container can call this. The container that holds the user's
 * open SSE stream will pick it up on its next poll cycle (see /api/friends/events).
 *
 * This function is fire-and-forget — it catches and logs errors so a Redis
 * outage never crashes a friend action.
 */
export async function publishToUser(userId: string, event: SSEEvent): Promise<void> {
  try {
    const redis = getRedis();
    const key = `${SSE_KEY_PREFIX}${userId}`;
    await redis.rpush(key, JSON.stringify(event));
    await redis.expire(key, SSE_QUEUE_TTL_SECONDS);
  } catch (error) {
    console.error(`[SSE Publisher] Failed to publish to user ${userId}:`, error);
  }
}

/**
 * Push the same SSE event into multiple users' queues.
 * Used by notifyFriendsLevelUp to broadcast to all of a user's friends.
 */
export async function publishToMany(userIds: string[], event: SSEEvent): Promise<void> {
  await Promise.allSettled(
    userIds.map((userId) => publishToUser(userId, event))
  );
}

/**
 * Pop the next pending SSE event from a user's Redis queue.
 * Returns the parsed SSEEvent, or null if the queue is empty.
 *
 * Called by the SSE route's polling loop.
 */
export async function consumeNextEvent(userId: string): Promise<SSEEvent | null> {
  try {
    const redis = getRedis();
    const key = `${SSE_KEY_PREFIX}${userId}`;
    const raw = await redis.lpop<string>(key);
    if (!raw) return null;

    // Upstash may return an already-parsed object or a string depending on how it was stored
    if (typeof raw === "string") {
      return JSON.parse(raw) as SSEEvent;
    }
    return raw as unknown as SSEEvent;
  } catch (error) {
    console.error(`[SSE Publisher] Failed to consume event for user ${userId}:`, error);
    return null;
  }
}
