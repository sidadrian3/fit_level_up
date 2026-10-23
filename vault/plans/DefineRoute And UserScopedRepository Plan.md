# DefineRoute And UserScopedRepository Plan

**Status:** Implemented, 2026-10-22. Issue [#24](https://github.com/sidadrian3/fit_level_up/issues/24). Step 2.2 in [[Architecture Overhaul Audit]] §8, implementing [[Architecture Overhaul Design Spec]] C2, C3 and C9. Refactor: no status code or response body changes, except routes that return 500 for bad input today.

## Problem Statement

Every route under `src/app/api` repeats the same four steps by hand: it resolves the user with `getAuthUserId()`, calls the rate limiter, parses the body with Zod, and wraps everything in `try/catch` → `handleApiError`. Each route has to remember each step, and the audit shows they forget (F-11: unthrottled mutations; F-12: a route that skipped validation). Nothing fails when a new route forgets. Data access has the same weakness: scoping by `userId` and validating ids is repeated in every `-db.ts` function, so an IDOR or a 500 on a malformed id is one missed line away.

## Solution

- **`createDefineRoute(deps)`** in `src/server/platform/http` owns auth, throttle, params/query/body parsing and error mapping. `src/server/runtime.ts` wires it, and every route exports `defineRoute({...}, handler)`. Routes contain no `try/catch` and never call `getAuthUserId`.
- **A route-table test** imports every `route.ts` and fails when a handler isn't built with `defineRoute`, when a user-auth mutation doesn't state its `body` or `throttle`, when a cron or public route sets `throttle`, or when two routes share a name.
- **`userScopedRepository<T>(collection)`** in `src/server/platform/database` makes every query take `userId` and turns malformed ids into `null`. `workout-templates-db.ts` becomes its first caller.

## Readiness

```
Preserved behavior covered by tests:  partial — route tests cover workouts POST, runs POST, exercises POST, quest claim,
                                      templates DELETE and cron auth. Hand-written 404 bodies in runs/[id] and workouts/[id]
                                      and the list routes' pagination are not covered; Task 1 characterizes them first.
Open questions:   none (settled in the grill, 2026-10-22)
Assumptions:      - the audit §8.3 kickoff prompt for 2.2 is authoritative (params, status, runtime.ts, constant-time cron check)
                  - event scope + after() dispatch (C2 steps 1, 10) wait for 2.5; Idempotency-Key (C2 step 7) waits for 2.4
Riskiest part:    route tests mock @/lib/auth/auth-helpers and @/lib/auth/rate-limit; defineRoute must reach auth and the
                  limiter through those modules (injected by runtime.ts) or the tests hit real better-auth/Upstash
```

## Decisions (from the grill, 2026-10-22)

1. **`throttle: null` is an explicit opt-out.** Mutations not rate-limited today (workouts/[id] PUT and DELETE, runs/[id] PUT and DELETE, templates POST and DELETE, quest claim) declare `throttle: null`. The route-table test requires the `throttle` key on every user-auth mutation, so leaving it out still fails. Step 2.3 removes `null` from the type, which makes those seven routes compile errors to fix.
2. **`ThrottleTier` is `"standard"` only in 2.2**, and it maps to today's limiter exactly: one 20/h bucket, keyed by `userId` alone. Step 2.3 adds `"expensive"`, the D2 numbers, the `<name>:<userId>` key, `Retry-After` and fail-open. Reviewed with the user: the two tiers are the minimum that fixes F-11 and guards friend-request spam.
3. **Auth and the limiter are injected.** `createDefineRoute({ requireUserId, limit })`. `runtime.ts` passes `getAuthUserId` from `@/lib/auth/auth-helpers` and `RateLimit.limit` from `@/lib/auth/rate-limit`, which are the seams the route tests mock. The session logic itself moves to `platform/auth` as `getSessionUserId(): Promise<string | null>`, and `getAuthUserId` becomes a wrapper that throws `UnauthorizedError` on `null`. Repointing `requireUserId` at `platform/auth` is a one-line change in `runtime.ts`, made when the route tests are next rewritten.
4. **The repository ships with one real caller:** `workout-templates-db.ts`. Its exported function signatures stay the same, so the service and the data test don't change.
5. **The template list is capped at `MAX_FIND_LIMIT` (200).** C3 makes `limit` required, and no user keeps 200 templates.
6. **Errors move, with no shims.** `AppError` and its subclasses move to `platform/http/errors.ts`, joined by a new `TooManyRequestsError` (429, `"Too many requests"`). `parseObjectId` and `isDuplicateKeyError` move to `platform/database`. Importers are retargeted directly. `src/lib/api/` and the two `lib/data` helper files are deleted.
7. **Malformed JSON is caught at the body read.** The body step turns a `request.json()` failure into `BadRequestError("Invalid JSON body")`. The spec's table instead maps every `SyntaxError` globally, which would also turn an unrelated `JSON.parse` bug in a service into a 400.
8. **Hand-written 404s become thrown `NotFoundError`s** with the same message (`"Run not found or invalid ID"`, `"Workout not found or invalid ID"`, `"Template not found"`).
9. **`paginationQuery` keeps `parseInt` semantics.** `limit`: non-numeric or below 1 → 5, above 50 → 50. `page`: non-numeric or below 1 → 1. This fixes today's 500 on `?page=0` and `?page=abc`.
10. **The SSE stream builder moves to `src/lib/sse/`.** The friends/events route's poll loop has a `try/catch` that detects a closed stream; it isn't error mapping. Moving the builder leaves the route a single call, and the module retires in 3.8.
11. **Params are typed by a schema.** `idParams = z.object({ id: z.string() })`, exported from `platform/http`. Without a `params` schema the handler gets `undefined`. Ids stay plain strings, and a malformed id is a 404 from the data layer (F-2).

## Interfaces (end state)

`@/server/platform/http`:

```ts
type RouteAuth = "user" | "cron" | "public";
type ThrottleTier = "standard";
interface RouteOptions<A, B, Q, P> {
  name: string; auth: A;
  body?: z.ZodType<B> | null; query?: z.ZodType<Q>; params?: z.ZodType<P>;
  throttle?: ThrottleTier | null; status?: 200 | 201;
}
interface RouteContext<A, B, Q, P> { request: Request; userId: A extends "user" ? string : undefined; body: B; query: Q; params: P }
type DefinedRoute = ((request: Request, segment?: { params: Promise<Record<string, string>> }) => Promise<Response>)
  & { definition: RouteOptions<RouteAuth, unknown, unknown, unknown> };
function createDefineRoute(deps: {
  requireUserId: () => Promise<string>;
  limit: (identifier: string) => Promise<{ success: boolean }>;
}): <A extends RouteAuth, B = undefined, Q = undefined, P = undefined, T = unknown>(
  options: RouteOptions<A, B, Q, P>, handler: (ctx: RouteContext<A, B, Q, P>) => Promise<T | Response>) => DefinedRoute;
function toErrorResponse(err: unknown, routeName: string): NextResponse;
const idParams; class AppError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, TooManyRequestsError;
```

**Pipeline:** auth → throttle → params → query → body → handler → response; any throw → `toErrorResponse(err, name)`.
- **auth:** `"user"` calls `requireUserId()`. `"cron"` compares `Authorization` with `Bearer ${env.CRON_SECRET}` by `timingSafeEqual` on SHA-256 digests (equal length, no length leak). `"public"` does nothing.
- **throttle:** `"standard"` → `limit(userId)`; `success: false` → `TooManyRequestsError`.
- **response:** a returned `Response` passes through untouched; any other value → `NextResponse.json(value, { status: status ?? 200 })`.

**Error mapping:**

| Thrown | Response |
|---|---|
| `AppError` subclass | its `statusCode`, `{ error: message }` |
| `DomainError` | `invalid` → 400, `conflict` → 409 |
| `ZodError` | 400, the first issue's message |
| `BSON.BSONError` | 404 `"Not Found"` (backstop) |
| anything else | 500 `"Internal Server Error"`, logged with the route name |

`@/server/platform/database` adds `userScopedRepository`, `UserScopedRepository`, `UserOwnedDoc`, `ScopedFilter`, `MAX_FIND_LIMIT`, `parseObjectId` and `isDuplicateKeyError`. The repository follows C3, with `AppCollection` = `CollectionKey`.
- `find` throws when `limit` exceeds `MAX_FIND_LIMIT`.
- Any update whose operator touches `userId` throws.
- `paginate` runs its count and find in parallel, or one after the other when a `session` is given.

`@/server/platform/auth` adds `getSessionUserId`. `@/shared/contracts/pagination` exports `paginationQuery`. `@/server/runtime` exports `defineRoute`.

---

## Tasks

Every task leaves `npx eslint <changed files> && npm run typecheck && npm run test:run` green and ends with its own commit. They run in order: Tasks 2–6 build what Tasks 7–9 consume, and Tasks 7 and 8 touch the shared error import that Task 9 deletes.

### Task 1: Characterization tests

**Files:** new `src/app/api/workouts/__tests__/item-route.test.ts`, `src/app/api/runs/__tests__/item-route.test.ts`, `src/app/api/workouts/__tests__/list-route.test.ts`
**Interfaces:** Consumes today's routes. Produces tests that pin behaviour Tasks 7–8 must keep.

1. workouts/[id] and runs/[id]: PUT with a valid body and an unknown or malformed id → 404 with the exact `error` text. DELETE likewise. Mock `@/lib/auth/auth-helpers` as the existing route tests do.
2. workouts GET: `?limit=500` → `data.length ≤ 50`, `totalPages` computed with 50; no params → limit 5 and `currentPage: 1`. Seed the documents through `getCollection` and clean them up.
3. These must pass against today's code. Commit `test(api): characterize item-route 404s and list pagination`.

### Task 2: Mongo helpers into `platform/database`

**Files:** new `src/server/platform/database/mongo-utils.ts`; modified `database/index.ts`, every importer of `@/lib/data/object-id` and `@/lib/data/mongo-errors` (6 `lib/data` files, 5 services); deleted `src/lib/data/object-id.ts`, `src/lib/data/mongo-errors.ts`.

1. Move `parseObjectId` and `isDuplicateKeyError` verbatim and export them from the database index.
2. Retarget the importers. Commit `refactor(database): move parseObjectId and isDuplicateKeyError into platform/database`.

### Task 3: `userScopedRepository`

**Files:** new `src/server/platform/database/user-scoped-repository.ts`, `src/server/platform/database/__tests__/user-scoped-repository.test.ts`; modified `database/index.ts`.

1. Write the integration test first, against the `workoutTemplates` collection with documents valid for its validator, under two users:
   - another user's document is invisible to `findById`, `findOne`, `find`, `count`, `updateById`, `deleteById` and `aggregate`;
   - a malformed id returns `null`;
   - `insertOne` sets `userId` and returns `_id`;
   - a duplicate key propagates;
   - `updateOne` with `upsert` scopes the insert;
   - `upsertMany` scopes every entry;
   - `paginate` returns `items` and `totalCount`;
   - `find` with `limit: 201` throws;
   - `updateById` with `{ $set: { userId } }` throws.
2. Implement it per C3. Commit `refactor(database): add userScopedRepository`.

### Task 4: `workout-templates-db.ts` on the repository

**Files:** modified `src/lib/data/workout-templates-db.ts`.

1. Build one module-level `userScopedRepository<WorkoutTemplateDoc>("workoutTemplates")`.
2. Map list → `find(userId, {}, { limit: MAX_FIND_LIMIT, sort: { createdAt: -1 } })`, key lookup → `findOne`, create → `insertOne(input.userId, rest)`, delete → `deleteById(...) !== null`. Exported signatures stay the same.
3. The existing data and route tests pass unchanged. Commit `refactor(database): back workout templates with userScopedRepository`.

### Task 5: Errors and error mapping into `platform/http`

**Files:** new `src/server/platform/http/{errors.ts,index.ts}`, `src/server/platform/http/__tests__/errors.test.ts`; modified `src/lib/api/handle-api-error.ts`, every importer of `@/lib/api/errors` (15 files); deleted `src/lib/api/errors.ts`, `src/lib/api/__tests__/handle-api-error.test.ts`.

1. Write the test first: move the three `handleApiError` cases, then add a ZodError case (first message), a BSONError case (404), a TooManyRequestsError case (429 `"Too many requests"`), and an unknown-error case (500 `"Internal Server Error"`).
2. Move the `AppError` family, add `TooManyRequestsError`, and implement `toErrorResponse(err, routeName)` with the mapping table. Until Task 9, `handleApiError(err)` delegates to `toErrorResponse(err, "legacy")`.
3. Retarget the importers to `@/server/platform/http`. Commit `refactor(http): move AppError family and error mapping into platform/http`.

### Task 6: `createDefineRoute`, `getSessionUserId`, `runtime.ts`, `paginationQuery`

**Files:** new `src/server/platform/http/define-route.ts`, `src/server/platform/http/__tests__/define-route.test.ts`, `src/server/platform/auth/session.ts`, `src/server/runtime.ts`, `src/shared/contracts/pagination.ts`, `src/shared/contracts/__tests__/pagination.test.ts`; modified `platform/http/index.ts`, `platform/auth/index.ts`, `src/lib/auth/auth-helpers.ts`.

1. Tests first. In `define-route.test.ts`, build `defineRoute` with fake `requireUserId` and `limit` and cover:
   - 401 when `requireUserId` throws;
   - 429 when `limit` says no, and no `limit` call when `throttle` is null or unset;
   - malformed JSON → 400 `"Invalid JSON body"`;
   - a Zod failure → 400 with the first issue's message;
   - a DomainError → 400/409, a ForbiddenError → 403 and an unknown error → 500;
   - `status: 201`;
   - a returned `Response` passes through with its headers;
   - params and query are parsed;
   - cron with a missing, wrong, or wrong-length bearer → 401, and the right bearer → handler runs;
   - `.definition` equals the options.

   `pagination.test.ts` covers the clamping table in Decision 9.
2. Implement `define-route.ts`, `paginationQuery` and `getSessionUserId`. The session logic moves from `getAuthUserId`, keeping its catch-and-log on session failure, and `getAuthUserId` wraps it.
3. `runtime.ts` exports `defineRoute = createDefineRoute({ requireUserId: getAuthUserId, limit: (id) => RateLimit.limit(id) })`, with a one-line comment saying why the lib seams are used (Decision 3).
4. Commit `refactor(http): add defineRoute and wire it in runtime.ts`.

### Task 7: Migrate training routes

**Files:** `src/app/api/{workouts,workouts/[id],runs,runs/[id],runs/stats,exercises,workout-templates,workout-templates/[id],profile/records}/route.ts`.

Each handler becomes `export const METHOD = defineRoute({ name, auth: "user", … }, handler)`, imported from `@/server/runtime`.

| Route | name | throttle | body | other |
|---|---|---|---|---|
| workouts GET | `workouts.list` | — | — | `query: paginationQuery` |
| workouts POST | `workouts.create` | `"standard"` | `CreateWorkoutSchema` | `status: 201` |
| workouts/[id] PUT | `workouts.update` | `null` | `CreateWorkoutSchema` | `params: idParams` |
| workouts/[id] DELETE | `workouts.delete` | `null` | `null` | `params: idParams` |
| runs GET / POST | `runs.list` / `runs.create` | — / `"standard"` | — / `CreateRunSchema` | as workouts |
| runs/[id] PUT / DELETE | `runs.update` / `runs.delete` | `null` | `CreateRunSchema` / `null` | `params: idParams` |
| runs/stats GET | `runs.stats` | — | — | |
| exercises GET / POST | `exercises.list` / `exercises.create` | — / `"standard"` | — / `CreateCustomExerciseSchema` | `status: 201` on POST |
| workout-templates GET / POST | `templates.list` / `templates.create` | — / `null` | — / `WorkoutTemplateSchema` | `status: 201` on POST |
| workout-templates/[id] DELETE | `templates.delete` | `null` | `null` | `params: idParams` |
| profile/records GET | `profile.records` | — | — | |

Drop the unused `z` imports. Task 1's tests and the existing route tests pass unchanged. Commit `refactor(api): migrate training routes to defineRoute`.

### Task 8: Migrate the remaining routes

**Files:** `src/app/api/{achievements,cron/achievements-sweep,friends,friends/[id],friends/[id]/accept,friends/[id]/decline,friends/events,friends/request,friends/requests,health,quests,quests/[id]/claim,stats/dashboard,user}/route.ts`; new `src/lib/sse/friend-event-stream.ts`.

| Route | name | auth | throttle | body |
|---|---|---|---|---|
| achievements GET | `achievements.list` | user | — | — (returns `NextResponse.json` with Cache-Control) |
| cron/achievements-sweep GET | `cron.achievements-sweep` | cron | — | — (keep `maxDuration`, `dynamic`) |
| friends GET | `friends.list` | user | — | — |
| friends/[id] DELETE | `friends.remove` | user | `"standard"` | `null` |
| friends/[id]/accept POST | `friends.accept` | user | `"standard"` | `null` |
| friends/[id]/decline POST | `friends.decline` | user | `"standard"` | `null` |
| friends/events GET | `friends.events` | user | — | — (keep `maxDuration`; returns `streamFriendEvents(userId)`) |
| friends/request POST | `friends.request` | user | `"standard"` | `SendFriendRequestSchema`, `status: 201` |
| friends/requests GET | `friends.requests` | user | — | — |
| health GET | `health` | public | — | — |
| quests GET | `quests.list` | user | — | — |
| quests/[id]/claim POST | `quests.claim` | user | `null` | `null` |
| stats/dashboard GET | `stats.dashboard` | user | — | — (Cache-Control as today) |
| user GET | `user.get` | user | — | — |

Move the SSE `ReadableStream` construction verbatim into `streamFriendEvents(userId): Response`. Commit `refactor(api): migrate social, quest, user, cron and health routes to defineRoute`.

### Task 9: Route-table test and cleanup

**Files:** new `src/app/api/__tests__/route-table.test.ts`; deleted `src/lib/api/handle-api-error.ts` (and the now-empty `src/lib/api/`).

1. The route-table test uses `import.meta.glob("../**/route.ts")` and skips `auth/[...all]`. For every exported `GET`/`POST`/`PUT`/`PATCH`/`DELETE` it asserts:
   - a `.definition` exists;
   - a user-auth mutation has the `"body"` and `"throttle"` keys;
   - a cron or public route has no non-null `throttle`;
   - names are unique across all routes.

   Prove it once (not committed): drop `throttle` from one mutation and see it fail.
2. Delete `handleApiError`.
3. Done-when check: `grep -rlE "try \{|try\{|getAuthUserId" src/app/api --include=route.ts` prints nothing.
4. Run `npm run lint && npm run typecheck && npm run test:run && npx next build`. The build checks Next's generated route-handler types against `DefinedRoute`. Commit `refactor(api): add route-table test and retire handleApiError`.

---

## Done When

- No `route.ts` contains `try/catch` or calls `getAuthUserId`.
- The existing route tests (workouts, runs, exercises, quest claim, templates, cron) pass unchanged, and Task 1's characterization tests pass.
- The route-table test passes, and fails when a mutation drops `body` or `throttle`.
- `npm run lint`, `npm run typecheck`, `npm run test:run` and `npx next build` pass.

## Out of Scope

- Rate-limit tiers, per-route keys, `Retry-After`, limiter fail-open (2.3).
- `Idempotency-Key` header (2.4).
- Event scope and `after()` dispatch in `defineRoute` (2.5).
- Moving route business logic into modules, e.g. `profile/records` computing records inline (3.4).
- Adopting `userScopedRepository` beyond workout templates (Phase 3 modules).
- Server Components' `getAuthUserId` calls in the dashboard and profile pages.

## Spec Amendments (applied with this plan)

[[Architecture Overhaul Design Spec]] C2 is amended in the same commit:
- In 2.2, `createDefineRoute` takes `requireUserId` and `limit` as deps (Decision 3). 2.5 adds `dispatchEvents`.
- `throttle` accepts `null` until 2.3 (Decision 1).
- Malformed JSON is mapped at the body read, not as a global `SyntaxError` (Decision 7).

[[Plans Index]]
