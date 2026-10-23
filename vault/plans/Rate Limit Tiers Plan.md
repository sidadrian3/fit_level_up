# Rate Limit Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single 20-per-hour Upstash bucket with `standard` and `expensive` tiers keyed by route name + userId, required on every user mutation, with `Retry-After` on 429.

**Architecture:** `RATE_LIMIT_TIERS` (platform/config) drives one Upstash `Ratelimit` per tier, built by `createRateLimiter` in platform/http and wired in `runtime.ts`. `defineRoute` calls `limit(tier, "<name>:<userId>")`, turns a refusal into `TooManyRequestsError(retryAfterSeconds)`, and lets the request through (with a log) on a limiter error or timeout. The route-table test makes a tier mandatory.

**Tech Stack:** Next.js 16 route handlers, `@upstash/ratelimit` 2.0.8, `@upstash/redis`, Vitest.

**Spec:** [[Rate Limit Tiers Design Spec]] (`vault/specs/Rate Limit Tiers Design Spec.md`)

## Global Constraints

- `standard: { requests: 30, window: "1 m" }`, `expensive: { requests: 10, window: "1 h" }`, `as const`.
- Limiter: `Ratelimit.slidingWindow`, `prefix: "rl:<tier>"`, `timeout: 1000`, no `analytics`. Identifier `"<routeName>:<userId>"`.
- 429 body stays `{ error: "Too many requests" }`; header `Retry-After` = `max(1, ceil((reset − Date.now()) / 1000))`.
- Fail-open log line: `console.error("[Rate limiter unavailable] <routeName>", <error or reason>)`.
- Imports across platform folders go through each folder's `index.ts` (ESLint entry-only rule). `vi.mock` path strings are not imports and may name `@/server/platform/http/rate-limiter`.

## Review Focus

- **Upstash throws (bad token, network)** → the handler still runs, and one error line is logged. Pinned in Task 1 (`allows and logs when the limiter throws`).
- **Upstash times out** → `success: true, reason: "timeout"` still logs. Pinned in Task 1 (`logs a limiter timeout and allows the request`).
- **`reset` already elapsed** (ephemeral-cache answer, or clock skew) → `Retry-After: 1`, never 0 or negative. Pinned in Task 1.
- **Two routes, one user** → separate buckets: the key carries the route name. Pinned in Task 1 (`keys the limit by route name and user`) and in the route tests.
- **A route test without the new mock** would hit the fake Upstash URL from `vitest.global-setup.ts`, fail open and pass a 429 test wrongly. Task 1 moves every mock, and its grep step proves that no `@/lib/auth/rate-limit` reference is left.

---

### Task 1: Tiered limiter in platform/http

**Layer:** platform (http, config) + composition root.

**Files:**
- Create: `src/server/platform/config/rate-limits.ts`
- Modify: `src/server/platform/config/index.ts` (export `RATE_LIMIT_TIERS`)
- Create: `src/server/platform/http/rate-limiter.ts`
- Modify: `src/server/platform/http/errors.ts` (`TooManyRequestsError`, `toErrorResponse`)
- Modify: `src/server/platform/http/define-route.ts` (`ThrottleTier`, deps, throttle step)
- Modify: `src/server/platform/http/index.ts` (export `createRateLimiter`, `RateLimitResult`)
- Modify: `src/server/runtime.ts`
- Delete: `src/lib/auth/rate-limit.ts`
- Test: `src/server/platform/http/__tests__/define-route.test.ts`, `src/server/platform/http/__tests__/errors.test.ts`, `src/app/api/{workouts,runs,exercises}/__tests__/route.test.ts`, `src/app/api/__tests__/route-table.test.ts` (mock path only)

**Builds on:** `createDefineRoute` and `toErrorResponse` from step 2.2; `env` from `@/server/platform/env`.

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `RATE_LIMIT_TIERS` from `@/server/platform/config`.
  - `type ThrottleTier = keyof typeof RATE_LIMIT_TIERS`. `RouteOptions.throttle` stays `ThrottleTier | null` in this task, and Task 2 removes `null`.
  - `interface RateLimitResult { success: boolean; reset: number; reason?: string }`
  - `DefineRouteDeps.limit: (tier: ThrottleTier, identifier: string) => Promise<RateLimitResult>`
  - `createRateLimiter(redis: Redis): DefineRouteDeps["limit"]` from `@/server/platform/http`
  - `new TooManyRequestsError(retryAfterSeconds: number, message?: string)` with a public `retryAfterSeconds`.

- [ ] **Step 1: Write the failing tests**

In `errors.test.ts`, replace the 429 case:

```ts
it("maps TooManyRequestsError to 429 with Retry-After", async () => {
  const response = toErrorResponse(new TooManyRequestsError(42), "test");
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("42");
  expect(await response.json()).toEqual({ error: "Too many requests" });
});
```

In `define-route.test.ts`, change `setup` so that `limit` is `vi.fn(async (): Promise<RateLimitResult> => result)`. `result` defaults to `{ success: true, reset: 0 }`, and `setup({ limit: … })` can override it (a result, or a function that throws). Run under `vi.useFakeTimers({ toFake: ["Date"] })` with `vi.setSystemTime(1_000_000)` for the throttle cases. Replace the existing 429 test, and add:

- `keys the limit by route name and user`: `throttle: "standard"`, name `"workouts.create"`, then `expect(limit).toHaveBeenCalledWith("standard", "workouts.create:user-1")`.
- `sends an expensive route to the expensive limiter`: `expect(limit).toHaveBeenCalledWith("expensive", "t:user-1")`.
- `returns 429 with Retry-After from reset, before the handler runs`: `{ success: false, reset: 1_000_000 + 29_500 }` gives status 429, header `"30"`, body `{ error: "Too many requests" }`, and the handler is not called.
- `floors Retry-After at 1 when reset has passed`: `reset: 1_000_000 - 5_000` gives header `"1"`.
- `allows and logs when the limiter throws`: `limit` rejects `new Error("ECONNREFUSED")`. Status is 200, the handler is called once, and `console.error` was called with `"[Rate limiter unavailable] t"` and the error.
- `logs a limiter timeout and allows the request`: `{ success: true, reset: 0, reason: "timeout" }`. Status is 200, and `console.error` was called with `"[Rate limiter unavailable] t"` and `"timeout"`.

Keep `does not call limit when throttle is null/undefined`.

In the three route tests, replace the `@/lib/auth/rate-limit` import and mock with:

```ts
const limit = vi.hoisted(() => vi.fn());
vi.mock("@/server/platform/http/rate-limiter", () => ({ createRateLimiter: () => limit }));
```

Resolve as `{ success: true | false, reset: Date.now() + 60_000 }` (no `as never`). Assert `limit` was called with `("standard", "workouts.create:fake-user-123")`, `("standard", "runs.create:fake-user-123")` and `("standard", "exercises.create:exercise-route-user")`. The 429 cases also assert that a `Retry-After` header is present. In `route-table.test.ts`, swap the `@/lib/auth/rate-limit` mock for the same `rate-limiter` mock.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/platform/http src/app/api`
Expected: FAIL. `TooManyRequestsError(42)` has no header, `limit` is called with `("user-1")`, and the route tests' mocked module isn't imported by anything yet.

- [ ] **Step 3: Implement**

- `rate-limits.ts`: `RATE_LIMIT_TIERS`, exactly as in Global Constraints. Add the export to `config/index.ts`.
- `errors.ts`: `TooManyRequestsError(public retryAfterSeconds: number, message = "Too many requests")`. In `toErrorResponse`, check it **before** the generic `AppError` branch and add `headers: { "Retry-After": String(err.retryAfterSeconds) }`.
- `define-route.ts`: `ThrottleTier` from `RATE_LIMIT_TIERS`, plus `RateLimitResult` and the new `limit` signature. Move the throttle into a private `enforceThrottle(deps, tier, name, userId)`:
  - await `limit`, catching a throw: log it and return;
  - `reason === "timeout"`: log and return;
  - `!success`: throw `TooManyRequestsError(Math.max(1, Math.ceil((reset - Date.now()) / 1000)))`.
- `rate-limiter.ts`: `createRateLimiter(redis)` builds one `Ratelimit` per entry of `RATE_LIMIT_TIERS` (`Ratelimit.slidingWindow(requests, window)`, `prefix: \`rl:${tier}\``, `timeout: 1000`). It returns `(tier, identifier) => limiters[tier].limit(identifier)`.
- `index.ts`: export `createRateLimiter` and `type RateLimitResult`.
- `runtime.ts`: `limit: createRateLimiter(new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }))`. Keep `requireUserId: getAuthUserId`, and change the seam comment so it names only the auth mock.
- Delete `src/lib/auth/rate-limit.ts`.

- [ ] **Step 4: Run tests and checks**

Run: `npx vitest run src/server/platform/http src/app/api && npm run typecheck && npx eslint src/server src/app/api`
Expected: PASS.
Run: `grep -rn "lib/auth/rate-limit" src`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/server src/app/api src/lib/auth/rate-limit.ts
git commit -m "feat(http): tiered per-route rate limiter with Retry-After"
```

### Task 2: A tier on every mutation

**Layer:** route.

**Files:**
- Modify: `src/server/platform/http/define-route.ts` (`throttle?: ThrottleTier`, no `null`)
- Modify: `src/app/api/workouts/[id]/route.ts`, `src/app/api/runs/[id]/route.ts`, `src/app/api/workout-templates/route.ts`, `src/app/api/workout-templates/[id]/route.ts`, `src/app/api/quests/[id]/claim/route.ts` (`throttle: null` → `"standard"`), `src/app/api/friends/request/route.ts` (`"standard"` → `"expensive"`)
- Test: `src/app/api/__tests__/route-table.test.ts`, `src/server/platform/http/__tests__/define-route.test.ts`

**Interfaces:**
- Consumes: `ThrottleTier` and `RATE_LIMIT_TIERS` from Task 1.
- Produces: `RouteOptions.throttle?: ThrottleTier`.

- [ ] **Step 1: Write the failing test**

In `route-table.test.ts`, replace the throttle check with one that requires a real tier:

```ts
if (!(definition.throttle && definition.throttle in RATE_LIMIT_TIERS)) {
  violations.push(`${label}: user mutation must name a throttle tier (${Object.keys(RATE_LIMIT_TIERS).join(" | ")})`);
}
```

Import `RATE_LIMIT_TIERS` from `@/server/platform/config`. Keep the `body` check, and keep the rule that cron and public routes must not set a throttle (now `definition.throttle !== undefined`).

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/api/__tests__/route-table.test.ts`
Expected: FAIL, listing the seven `throttle: null` mutations: `PUT/DELETE /api/workouts/[id]`, `PUT/DELETE /api/runs/[id]`, `POST /api/workout-templates`, `DELETE /api/workout-templates/[id]` and `POST /api/quests/[id]/claim`.

- [ ] **Step 3: Implement**

Set the seven routes to `throttle: "standard"` and `friends.request` to `"expensive"`. Remove `| null` from `RouteOptions.throttle`. In `define-route.test.ts`, change `it.each([null, undefined])` to a single `undefined` case.

- [ ] **Step 4: Run tests and checks**

Run: `npm run typecheck && npx eslint src/app/api src/server/platform/http && npx vitest run src/app/api src/server/platform/http`
Expected: PASS. Typecheck rejects any `throttle: null` that is left.

- [ ] **Step 5: Commit**

```bash
git add src/app/api src/server/platform/http
git commit -m "feat(api): require a rate-limit tier on every mutation"
```

[[Plans Index]]
