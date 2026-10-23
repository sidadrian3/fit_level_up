# Rate Limit Tiers Design Spec

**Status:** Approved, 2026-10-23, after a brainstorm and grilling pass. Closes audit finding F-11 (step 2.3 in [[Architecture Overhaul Audit]]) and implements decision D2 of [[Architecture Overhaul Design Spec]]. API only, so the design critique (Step 3.5) does not apply.

## Problem Statement

One Upstash limiter (`slidingWindow(20, "1 h")` in `src/lib/auth/rate-limit.ts`) is keyed by `userId` alone and shared by every throttled mutation. A heavy training day plus a few friend actions locks a user out of everything for up to an hour. Seven mutations are not limited at all: `PUT/DELETE /api/workouts/[id]`, `PUT/DELETE /api/runs/[id]`, `POST /api/workout-templates`, `DELETE /api/workout-templates/[id]` and `POST /api/quests/[id]/claim`. They opt out with `throttle: null`, which step 2.2 allowed as a stop-gap. A refused request gets a 429 with no hint of when to try again.

## Solution

Two tiers, `standard` and `expensive`, each backed by its own Upstash limiter and keyed by **route name + userId**. Every user mutation must name a tier through `defineRoute({ throttle })`. The route-table test fails when one does not, and the type no longer accepts `null`. A 429 carries a `Retry-After` header. When the limiter is down or slow, the request is allowed and the failure is logged.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | `RATE_LIMIT_TIERS` lives in `src/server/platform/config/rate-limits.ts`: `standard` 30 per `"1 m"`, `expensive` 10 per `"1 h"`, `as const` | D2. The values are platform tuning, not game rules, so they sit beside `GAME_CONFIG` rather than inside it |
| 2 | `expensive` applies only to `friends.request`; every other user mutation is `standard` | D2. It is the one mutation that writes into another user's inbox (the unlimited re-request in [[Known Issues]]) |
| 3 | One `Ratelimit` per tier: `slidingWindow`, `prefix: "rl:<tier>"`, `timeout: 1000`, no `analytics`. Identifier `"<routeName>:<userId>"` | D2. A per-route key means a burst of edits cannot block logging. `analytics` added a Redis write per check and nothing reads its dashboard |
| 4 | Over the limit → `429 { error: "Too many requests" }` with `Retry-After` in whole seconds: `max(1, ceil((reset − now) / 1000))` from the limiter's `reset` | D2. The body shape is unchanged, so `apiFetch` shows the same message |
| 5 | `Retry-After` is a **lower bound**. Upstash's sliding window reports the end of the current fixed window. Just after it, the previous window still weighs almost fully, so a retry at that moment can be refused again | Computing the true wait needs both window counts, which the public API does not expose. No client retries a 429 automatically |
| 6 | Limiter failure is fail-open: a thrown client error and a `reason: "timeout"` result both log `console.error("[Rate limiter unavailable] <routeName>", …)` and let the request through | D2: abuse protection, not an access boundary. The library resolves a timeout as `success: true` silently (verified in v2.0.8: `timeout` defaults to 5000 ms and resolves `{ success: true, reason: "timeout" }`), so without the explicit check an outage would leave no trace |
| 7 | The throttle runs after auth and before params, query and body parsing | D2's pipeline order. Malformed requests count against the bucket, which is what abuse protection wants |
| 8 | GET routes stay unthrottled; `throttle` stays optional in the type, and the route-table test requires it on user mutations | Scope is "every mutation". A GET can opt into a tier later without a contract change |
| 9 | The limiter is abuse protection, not an anti-XP-farming guard: logging stays `standard` | Farming is already possible through large durations and F-4. Fair XP belongs to the ledger (steps 3.1 and 3.5), not to the limiter |
| 10 | No key migration. Keys under the old default prefix expire within an hour | The old window is one hour |

## Contract

```ts
// src/server/platform/config/rate-limits.ts
export const RATE_LIMIT_TIERS = {
  standard: { requests: 30, window: "1 m" },
  expensive: { requests: 10, window: "1 h" },
} as const;

// src/server/platform/http/define-route.ts
export type ThrottleTier = keyof typeof RATE_LIMIT_TIERS; // "standard" | "expensive"

export interface RouteOptions<A, B, Q, P> {
  // … unchanged …
  /** Required on every user mutation (route-table test). Not allowed with "cron" or "public". */
  throttle?: ThrottleTier;
}

export interface RateLimitResult {
  success: boolean;
  /** Unix ms when the current window ends. */
  reset: number;
  reason?: string;
}

interface DefineRouteDeps {
  requireUserId: () => Promise<string>;
  limit: (tier: ThrottleTier, identifier: string) => Promise<RateLimitResult>;
}

// src/server/platform/http/errors.ts
export class TooManyRequestsError extends AppError {
  constructor(public retryAfterSeconds: number, message = "Too many requests") { … }
}
// toErrorResponse adds the header: Retry-After: <retryAfterSeconds>
```

`src/server/platform/http/rate-limiter.ts` exports `createRateLimiter(redis: Redis)`, which returns the `limit(tier, identifier)` function built from `RATE_LIMIT_TIERS`. `src/server/runtime.ts` wires it with a `Redis` client from the validated `env` (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`). `src/lib/auth/rate-limit.ts` is deleted.

### Route tiers

| Route | Tier |
|---|---|
| `workouts.create`, `workouts.update`, `workouts.delete` | standard |
| `runs.create`, `runs.update`, `runs.delete` | standard |
| `templates.create`, `templates.delete` | standard |
| `exercises.create` | standard |
| `quests.claim` | standard |
| `friends.accept`, `friends.decline`, `friends.remove` | standard |
| `friends.request` | expensive |
| every GET, `cron.*`, `health` | none |

## Testing

- **`define-route.test.ts`** (injected deps): a throttled route calls `limit(tier, "<name>:<userId>")`; a refusal returns 429 with the exact `Retry-After` (fake clock); a `reset` in the past gives `Retry-After: 1`; a thrown limiter error and a `reason: "timeout"` result both reach the handler and log; an unthrottled route never calls `limit`; `expensive` reaches the limiter as `expensive`.
- **`errors.test.ts`**: `TooManyRequestsError` maps to 429 with the header and the unchanged body.
- **`route-table.test.ts`**: every user mutation's `throttle` is a key of `RATE_LIMIT_TIERS`; cron and public routes have none.
- **Route tests** (workouts, runs, exercises) mock the limiter module instead of `@/lib/auth/rate-limit` and assert the tier and the route-scoped key.
- `rate-limiter.ts` gets no test of its own. It is a thin adapter over Upstash, the one external boundary the tests mock.

## Out of Scope

- **Throttling heavy reads.** `profile.records` and `runs.stats` load every activity, and `friends.events` holds a stream open. They could take `standard` later without a contract change.
- Rate-limiting better-auth's own endpoints (sign-in brute force); see [[Architecture Overhaul Design Spec]] Out of Scope.
- Client handling of `Retry-After` (countdowns, automatic retry).
- Anti-farming limits on XP gain (steps 3.1 and 3.5).

[[Specs Index]]
