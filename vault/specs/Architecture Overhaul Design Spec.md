# Architecture Overhaul Design Spec

**Status:** Draft, 2026-10-22. Step 1.1 in [[Architecture Overhaul Audit]]: settles every §7.2 open question and fixes the contracts Phases 2–3 build on. Spec only; no code changes. Type API (no visual surface), so the design critique (Step 3.5) does not apply.

Read the audit first: §5–§8 are this spec's input. Where this spec and audit §6 disagree, this spec wins; §6 is marked as amended.

## Problem Statement

The audit settled the big choices (one Next.js package, MongoDB, better-auth, Vercel serverless, strangler migration) but left seven questions open (§7.2): how notifications reach the browser, how rate limiting works, which tool enforces module boundaries, the module order, how existing data migrates, and whether to adopt the three §5.3 proposals (transactional outbox, XP ledger, game content in code). Phase 2 cannot start until those are answered, because each answer changes what `src/server/platform/` contains. Phase 2 also needs fixed contracts (`defineRoute()`, `UserScopedRepository<T>`, the event and outbox documents, `schema.ts`) so that every module move in Phase 3 targets the same shapes.

## Solution

- **Side effects** go through a transactional outbox: `emit()` writes an event document in the caller's transaction. After the response, the request delivers only the events it emitted (by id), plus at most three overdue ones. The daily cron is the floor.
- **Notifications** are a persistent inbox, read by browser polling every 30 seconds while the tab is visible. SSE and the Redis queue retire.
- **Rate limiting** stays on Upstash, keyed by user and route, in two tiers.
- **Boundaries** are enforced by ESLint for file-level rules (editor feedback), dependency-cruiser for graph rules (cycles, who may import whom), and the `server-only` package.
- **XP** is recorded in an `xp_ledger`, which is the source of truth. The profile caches the total.
- **Quest and achievement definitions** become typed constants.
- **Data migration** uses numbered, idempotent scripts run at build. There is no dual-running period, because production holds mostly test accounts.

## Constraints

| Constraint | Source | Consequence |
|---|---|---|
| Vercel **Hobby**, staying | User, 2026-10-22 | Cron runs at most once a day. Functions are short-lived, so SSE reconnects every ~60 s |
| Production data is **mostly test accounts** | User, 2026-10-22 | Backfills may recompute values (XP may drop for accounts that edited activities); no dual-read period |
| One Next.js package, MongoDB, better-auth, serverless | Audit §7.1 #1–#4 | No NestJS DI, no long-running worker, no Postgres |
| Quest progress commits with the activity | Audit §7.1 #5 | `training → quests` stays a direct call in the transaction |
| Strangler migration | Audit §7.1 #7 | Every contract here must coexist with the old `src/lib/` back end until step 5.1 |

## Goals, Non-Goals, Anti-Goals

- **Goals**
  - A side effect can be delayed, but never silently lost.
  - Every mutation route is authenticated, validated and rate-limited by construction, not by memory.
  - Every query on single-owner data is scoped by `userId` through the type system.
  - XP, level and totals are exactly reproducible after edits and deletes.
  - One file describes the whole data model.
  - Module boundaries fail the build (or the editor) when crossed.
- **Non-goals**
  - Implementing any of it. Steps 2.1 onward do that.
  - Settling the edit/delete edge cases (unlocked achievements, claimed quests, level-down notices). Step 3.5's brainstorm owns them.
  - Rate-limiting better-auth's own endpoints (sign-in brute force). That's a separate follow-up; see Out of Scope.
  - Alerting or paging on outbox failures.
- **Anti-goals**
  - Outbox work on requests that emitted nothing. Recovery cost must scale with writes, never with reads or open tabs.
  - A platform file that imports a feature module.
  - Registration by side effect: a listener that silently doesn't run because some startup hook didn't fire.
  - A route that can skip validation or throttling by forgetting an option.
  - A validator so strict it blocks a migration of old data.

---

## Decisions (audit §7.2)

### D1. Real-time delivery: polling an inbox, not SSE

**Decision:** retire `/api/friends/events`, `sse-publisher`, `sse-registry` and the Redis queue (step 3.8). Notifications are documents in a `notifications` collection. The browser polls `GET /api/notifications?since=` with React Query:

- every **30 s** while the tab is visible (`refetchIntervalInBackground: false`);
- on window focus;
- immediately after the user's own mutations.

| Option | Verdict |
|---|---|
| SSE reading the inbox | Rejected. On Hobby, a function lives ~60 s, so every tab still reconnects every minute. A held-open function per tab polls Mongo internally anyway, so it is polling with extra moving parts |
| Mongo change streams pushed over SSE | Rejected. Needs a long-lived connection per tab, which is the same serverless problem |
| **Client polling of the inbox** | **Chosen.** Each poll is one short indexed query. Upstash leaves the notification path entirely. Offline users see what happened the next time they open the app. Cost: up to ~30 s delay on a friend's notice |
| Hosted push service (Pusher, Ably) | Deferred. This is the **scale exit**: if polling load ever matters, swap delivery only. How notifications are written does not change |

The poll interval is a browser constant (`NOTIFICATION_POLL_INTERVAL_MS = 30_000`) in `src/lib/notifications/`, so it can be tuned without touching the server.

### D2. Rate-limit backend: Upstash, per user and route, two tiers

**Decision:** Upstash stays, since serverless has no shared memory. Every throttled request is keyed by **tier + route name + userId**. Per-IP limiting is wrong for a logged-in app behind mobile-carrier NAT. One global bucket is what locked users out on heavy days (F-11).

```ts
// src/server/platform/config/rate-limits.ts
export const RATE_LIMIT_TIERS = {
  standard: { requests: 30, window: "1 m" },
  expensive: { requests: 10, window: "1 h" },
} as const;
```

- **`standard`** applies to every mutation unless listed otherwise.
- **`expensive`** applies only to `POST /api/friends/request`, because it writes into another user's inbox (a spam vector; see the unlimited re-request in [[Known Issues]]).
- **Limiter shape:** one `Ratelimit` instance per tier (`slidingWindow`, `prefix: "rl:<tier>"`), identifier `"<routeName>:<userId>"`.
- **Over limit:** `429 { error: "Too many requests" }` with a `Retry-After` header in whole seconds, taken from the limiter's `reset`.
- **Upstash unreachable or slow:** the request is **allowed**, and the error is logged. The limiter's `timeout` option is set to ~1 s, and a thrown client error is caught inside `defineRoute`. Rate limiting here is abuse protection, not an access-control boundary, so availability wins. Step 2.3 verifies the library's timeout semantics against its docs.
- **Routes with `auth: "cron"` or `"public"`** are not throttled; they have no user to key on.

### D3. Boundary tooling: ESLint for files, dependency-cruiser for the graph, `server-only` for the build

**Decision:** split the rules by kind, so no rule exists in two places.

| Kind | Tool | Why |
|---|---|---|
| What one file may import | ESLint `no-restricted-imports` (built in, no new dependency) | Red underline in VS Code as you type; runs in `npm run lint`, so CI and the pre-commit hook get it too |
| Shape of the whole graph | `dependency-cruiser` (one dev dependency, `.dependency-cruiser.cjs`) | ESLint cannot check cycles or "nothing imports X" cheaply. `eslint-plugin-boundaries` has no cycle check, and `import/no-cycle` is slow |
| Server code never reaching the browser bundle | `server-only` imported by every `index.ts` under `src/server/` | The Next build fails if a client component pulls it in |

`npm run lint` becomes `eslint && depcruise src --config .dependency-cruiser.cjs`, so the existing CI "Run Linter" step picks it up. The pre-commit hook lints only staged files, so it runs `depcruise` explicitly. Violations already in old `src/lib` code go in a known-violations baseline (`--ignore-known`) that step 5.1 empties.

**ESLint rules (file-level)**

| # | Applies to | Rule |
|---|---|---|
| E1 | all of `src/` | Import a server module only through its entry: `@/server/<module>` or `@/server/platform/<area>`. Anything deeper (`@/server/training/workouts/...`) is blocked. Inside a module, use relative imports. One generic pattern, so adding a module needs no config change |
| E2 | `src/server/**/*.rules.ts` | May not import `mongodb`, `next`, `next/*`, `@/server/platform/{database,http,events,auth,env}`, or any `*.repository` file. Allowed: own-module `*.rules.ts` and `types.ts`, `@/shared/**`, `@/server/platform/config`, `@/server/platform/domain` |

**dependency-cruiser rules (graph-level)**

| # | Rule |
|---|---|
| G1 | No circular dependencies anywhere in `src/` |
| G2 | `src/shared/**` imports nothing from `src/server`, `src/lib`, `src/components` or `src/app` |
| G3 | `src/lib/**` and `src/components/**` import nothing from `src/server/**`. **Strangler exemption until 5.1:** the old back-end folders `src/lib/{services,domain,data,sse,api,auth}` are exempt, and the exemption is deleted in 5.1 |
| G4 | `src/server/platform/**` imports no feature module and not `src/server/runtime.ts` |
| G5 | No file under `src/server/` except `runtime.ts` imports `src/server/notification/**` or `src/server/achievements/**`. `src/app/**` may import `achievements` (for `GET /api/achievements`) and `notification` (for its routes) |
| G6 | `src/server/runtime.ts` is imported only from `src/app/**` |
| G7 | Only `*.repository.ts` files and `src/server/platform/database/**` obtain a collection handle (`getCollection`). Type-only `mongodb` imports (`ClientSession`, `ObjectId`) are allowed everywhere on the server. **Enforced by ESLint as rule E3** (`importNames`), since dependency-cruiser sees which module is imported, not which names ([[Platform Skeleton Plan]]) |

Step 2.1 proves the setup once: a deliberate deep import fails `npm run lint`, then it is reverted.

### D4. Module order: confirmed, with scope changes

The §8 order stands: **platform → progression → quests → training → achievements → social → notification**. Each module moves only after the modules it calls, and `notification` listens to everyone, so it goes last. Step 3.2 (game content) can run any time after 2.1, and 3.7 (social) can run in parallel with 3.3–3.6.

These step scopes change; audit §8 is updated to match:

| Step | Change |
|---|---|
| 2.1 | Also creates `src/shared/` (schemas, wire types, calendar helpers), the migration runner, the `server-only` Vitest alias, and the custom-exercises collection rename (see C8) |
| 2.2 | `defineRoute` is imported by routes from `@/server/runtime`, not from platform directly (see C9) |
| 2.5 | The cron route becomes `/api/cron/outbox-sweep`, replacing `/api/cron/achievements-sweep` in `vercel.json`. Ships the `npm run outbox` script |
| 3.1 | `grantXp`/`recordActivity` take a `source` and write `xp_ledger` rows from day one. `timeZone` stays on the auth `user` (D7). `lastActivityDate` becomes `lastActivityDay: "YYYY-MM-DD"` |
| 3.5 | Ledger **backfill** plus edit/delete **reversal**. The write path already exists from 3.1 |
| 3.8 | Polling, not SSE (D1). Depends on 3.6 and 3.7 only for their events |

### D5. Data migration: numbered idempotent scripts at build, expand-only until 5.1

**Decision:**

- **Scripts.** Each step that changes stored data adds `src/scripts/migrations/NNN-<name>.ts`, exporting `up(db: Db): Promise<void>`.
- **Order at build.** `migrate-db.ts` runs pending migrations in order, then `applySchema()` (validators and indexes, C8). A migration that cleans data runs before the unique index that needs it, as `prepare-unique-indexes.ts` does today. That script becomes migration `001`.
- **Tracking.** Applied migrations are recorded in a `schema_migrations` collection (`{ _id: "<NNN-name>", appliedAt }`), so builds don't rerun every script forever.
- **Idempotence.** Every script stays idempotent anyway (`$setOnInsert`, upserts, guards), so a crash halfway through is safe to rerun.
- **Expand-only until 5.1.** No migration deletes or renames a field the previous deploy reads, so a Vercel instant rollback still finds its data. Old game fields stay on the auth `user` document until the 5.1 cleanup migration unsets them.
- **No dual-read, no flags.** A step backfills and switches its reads in the same deploy. That's acceptable because production is mostly test accounts.

| Backfill | Step | Source → target |
|---|---|---|
| Player profiles | 3.1 | Each `user` with game fields → `player_profiles` upsert (`$setOnInsert`): `totalXp = calcLifetimeXp(level, xp)`, streak, `lastActivityDay` (the UTC-midnight `lastActivityDate` sliced to `YYYY-MM-DD`; it already holds the user's local day), stamina, totals |
| Quest ids | 3.2 | `user_quests.questTemplateId` ObjectId strings → stable string ids, by matching the old template's title/metric |
| XP ledger | 3.5 | Every workout and run → a ledger row (`xpEarned`, the activity's `date`). Every claimed `user_quests` row → `quest_claim` (reward from the definitions). Then `player_profiles.totalXp` is set to the ledger sum. Test accounts that exploited F-4 lose that XP, which is the correct result |
| Notifications | 3.8 | None. The inbox starts empty |

New users get their profile lazily: progression upserts a default profile (`$setOnInsert`) inside the first transaction that touches it, and reads fall back to defaults. There's no better-auth hook, so a failed hook cannot leave a user without a profile.

### D6. The three §5.3 proposals: all adopted

**D6a. Transactional outbox (adopted)** over `after()` plus per-feature sweeps. Per-feature sweeps mean one bespoke recovery job per side effect, and level-up notices have none today. The outbox gives one generic recovery path, durable on serverless. Contracts are in C4–C5.

**D6b. XP ledger as source of truth (adopted)** over counters reconciled by hand. Hand reconciliation needs a compensating write per edit case, and levelling down is easy to get wrong. A ledger keyed by source makes edit (replace the row) and delete (remove the row) exact by construction, and lets a `GAME_CONFIG` change be replayed. Workout-count and distance totals don't use the ledger: the training use case passes an exact delta (`-1` workout, `-3.2` km), since it holds both the old and new activity in the transaction. Contract in C6.

**D6c. Game content in code (adopted)** over seeded collections. Definitions become `as const` tables, reviewed in git, with stable string ids (`"daily_workout_1"`, `"first_workout"`). This removes seed drift, ObjectId template ids (F-2 on templates), a DB read per evaluation, and `npm run seed`. The `quest_templates` and `achievements` collections retire in 3.2.

### D7. `timeZone` stays on the auth `user` document

It describes the person, not their progress. better-auth already validates and writes it (`additionalFields`, written at signup and by `TimeZoneSync`). Moving it would mean a backfill and rewriting two client writers for no behaviour gain. Progression reads it through one accessor in `platform/auth`:

```ts
getUserTimeZone(userId: string, options?: { session?: ClientSession }): Promise<string> // "UTC" when unset
```

This amends audit §6.4 ("`timeZone` per user … step 3.1 decides").

### D8. Layout correction: `src/shared/` for code both sides run

`WorkoutForm` and `RunForm` import the same Zod schemas as the routes, and 26 component and page files import `lib/types`. Audit §6.2 put `workout.schemas.ts` under `src/server/`, which is server-only, so client forms could not import it. Shared contracts therefore live in a third area (C1).

---

## Contracts

### C1. Folder layout (amends audit §6.1)

```
src/
  app/                               pages and route.ts files only
    api/**/route.ts                  export const POST = defineRoute({...}, handler)
  shared/                            isomorphic: imports only zod and itself (G2)
    contracts/<domain>.ts            Zod input schemas + inferred input types + response DTO types
    contracts/pagination.ts          shared paginationQuery schema
    time/calendar.ts                 toLocalDay, addDays, startOfWeek, isValidTimeZone
  server/                            server-only
    runtime.ts                       composition root: wired defineRoute, drainOutbox, LISTENERS (C9)
    platform/
      env/                           server env.ts (no collection-name vars); the one client variable lives in src/lib/env.ts,
                                     because the browser auth client reads it; next.config.ts imports both files directly
      config/                        GAME_CONFIG, RATE_LIMIT_TIERS, OUTBOX_TUNING (pure constants)
      domain/                        DomainError and other pure building blocks for *.rules.ts
      database/                      client, schema.ts, applySchema, withTransaction,
                                     userScopedRepository, parseObjectId, isDuplicateKeyError
      http/                          createDefineRoute, errors (AppError family), error mapping, rate limiter
      events/                        EventMap, emit, listener types, dispatcher, event scope
      auth/                          better-auth instance, getSessionUserId, getUserTimeZone
    progression/  quests/  training/  achievements/  social/  notification/
  lib/<domain>/{hooks,utils}/        browser only: query keys, hooks, client helpers
  components/                        unchanged (ui/, shared/, feature folders)
```

Module anatomy is audit §6.2, with one change: input schemas live in `src/shared/contracts/<domain>.ts`, not in `<feature>.schemas.ts`. Response DTO types (`Workout`, `Run`, `Quest`, …) move from `src/lib/types.ts` to `src/shared/contracts/` as their module moves. `src/lib/types.ts` then re-exports them until 4.1 retargets the imports.

**Rule change for AGENTS.md (applied in 5.1):** document types (`*Doc`) live in `schema.ts`, not beside a `-db.ts` file. Shared request and response types live in `src/shared/contracts/`.

### C2. `defineRoute()`

`src/server/platform/http/define-route.ts` exports `createDefineRoute(deps)`. Routes import the wired `defineRoute` from `@/server/runtime` (C9).

```ts
export type RouteAuth = "user" | "cron" | "public";
export type ThrottleTier = keyof typeof RATE_LIMIT_TIERS; // "standard" | "expensive"

export interface RouteOptions<A extends RouteAuth, B, Q, P> {
  /** Stable id, e.g. "workouts.create". Keys the rate limit and labels error logs. Unique across routes. */
  name: string;
  auth: A;
  /** Mutations must state it: a schema, or null when the route takes no body. */
  body?: z.ZodType<B> | null;
  query?: z.ZodType<Q>;
  params?: z.ZodType<P>;
  /** Required on every mutation with auth "user" (route-table test). Not allowed with "cron" or "public". */
  throttle?: ThrottleTier;
  /** Success status for a plain return value. Default 200. */
  status?: 200 | 201;
  /** Step 2.4: requires an Idempotency-Key header and a replay-aware handler result. */
  idempotency?: "required";
}

export interface RouteContext<A extends RouteAuth, B, Q, P> {
  request: Request;
  userId: A extends "user" ? string : undefined;
  body: B;
  query: Q;
  params: P;
  /** Set only when idempotency: "required". */
  idempotencyKey: string | undefined;
}

/** Handler result for idempotency: "required" routes. */
export interface IdempotentResult<T> { value: T; replayed: boolean }

type RouteHandler = (request: Request, segment: { params: Promise<Record<string, string>> }) => Promise<Response>;
export type DefinedRoute = RouteHandler & { definition: RouteOptions<RouteAuth, unknown, unknown, unknown> };

export function createDefineRoute(deps: { dispatchEvents: (ids: ObjectId[]) => Promise<void> }):
  <A extends RouteAuth, B = undefined, Q = undefined, P = undefined, T = unknown>(
    options: RouteOptions<A, B, Q, P>,
    handler: (ctx: RouteContext<A, B, Q, P>) => Promise<T | Response>,
  ) => DefinedRoute;
```

**Pipeline, in order**

1. **Event scope.** Open an event scope (`AsyncLocalStorage`, C4) that collects outbox ids emitted during this request.
2. **Auth.**
   - `"user"`: `getSessionUserId()`, or `UnauthorizedError` (401).
   - `"cron"`: the bearer token compared to `CRON_SECRET` with `crypto.timingSafeEqual` (this closes the 2.3 carry-over), or 401.
   - `"public"`: nothing.
3. **Throttle.** `limit("<name>:<userId>")` on the tier's limiter. Over the limit throws `TooManyRequestsError(retryAfterSeconds)`. A limiter error is logged and the request allowed (D2).
4. **Params.** `await segment.params`, then parse with `params` if given. Ids stay plain strings: a malformed id is a 404 from the repository (C3), not a 400, which preserves Phase 0 (F-2).
5. **Query.** `Object.fromEntries(new URL(request.url).searchParams)`, then parse with `query`.
6. **Body.**
   - A schema: `request.json()`. Malformed JSON → `400 { error: "Invalid JSON body" }` (500 today). Then parse.
   - `null` or omitted: never read.
7. **Idempotency (2.4).** Read the `Idempotency-Key` header (8–128 chars). Missing or invalid → 400.
8. **Handler.**
9. **Response.**
   - A returned `Response` passes through untouched (e.g. a stream).
   - An `IdempotentResult` → `status` with the value. When `replayed`, the response is 200 with an `Idempotent-Replayed: true` header.
   - Anything else → `NextResponse.json(value, { status })`.
10. **Dispatch.** On a status below 400, if the event scope collected ids: `after(() => deps.dispatchEvents(ids))` (C5).
11. **Errors.** Any throw → `toErrorResponse(err, name)`. Routes contain no try/catch.

**Error mapping** (`platform/http/errors.ts`, one table; the body is always `{ error: string }`, as today):

| Thrown | Status |
|---|---|
| `AppError` subclasses (`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`) | its `statusCode` |
| `TooManyRequestsError` (new) | 429 + `Retry-After` |
| `DomainError` `invalid` / `conflict` | 400 / 409 |
| `ZodError` | 400, first issue's message |
| `SyntaxError` from the body read | 400 `"Invalid JSON body"` |
| `BSONError` (backstop; the repository should prevent it) | 404 |
| anything else | 500 `"Internal Server Error"`, logged with the route `name` |

**Pagination** keeps today's lenient behaviour rather than turning bad input into 400s. `paginationQuery` in `src/shared/contracts/pagination.ts`:

- `limit`: non-numeric or below 1 → 5, above 50 → 50.
- `page`: non-numeric or below 1 → 1.

**Route-table test** (2.2, `src/app/api/__tests__/route-table.test.ts`): globs every `src/app/api/**/route.ts`, imports it and inspects each exported handler. Exempt: `api/auth/[...all]` (better-auth's handler). It fails when:

- an exported handler has no `.definition` (not built with `defineRoute`);
- a `POST`/`PUT`/`PATCH`/`DELETE` with `auth: "user"` lacks `throttle`, or lacks a `body` key (a schema or explicit `null`);
- `throttle` is set on a `"cron"` or `"public"` route;
- two routes share a `name`.

**Example:**

```ts
// src/app/api/workouts/route.ts
export const GET = defineRoute(
  { name: "workouts.list", auth: "user", query: paginationQuery },
  ({ userId, query }) => listWorkouts(userId, query),
);

export const POST = defineRoute(
  { name: "workouts.create", auth: "user", throttle: "standard", body: CreateWorkoutSchema, status: 201 },
  ({ userId, body }) => logWorkout(body, userId),
);
```

**Server Components** use `getSessionUserId()` from `@/server/platform/auth` (redirecting on `null`) and call module `index.ts` functions. They never reach a repository.

### C3. `UserScopedRepository<T>`

A factory, not a base class. That matches the codebase's plain-function style and avoids `this` binding. Module repositories compose it and add named queries built only from its methods.

```ts
// src/server/platform/database/user-scoped-repository.ts
export interface UserOwnedDoc { _id: ObjectId; userId: string }

/** A filter that cannot set the owner or the id; the repository adds them. */
export type ScopedFilter<T extends UserOwnedDoc> = Omit<Filter<T>, "userId" | "_id">;

export interface SessionOption { session?: ClientSession }
export interface FindOptions<T> extends SessionOption {
  limit: number;                     // required; at most MAX_FIND_LIMIT (200), above it throws
  sort?: Sort;
  skip?: number;
  projection?: Partial<Record<keyof T, 0 | 1>>;
}

export interface UserScopedRepository<T extends UserOwnedDoc> {
  /** A malformed id returns null, never throws. */
  findById(userId: string, id: string, options?: SessionOption): Promise<T | null>;
  findOne(userId: string, filter: ScopedFilter<T>, options?: SessionOption): Promise<T | null>;
  find(userId: string, filter: ScopedFilter<T>, options: FindOptions<T>): Promise<T[]>;
  paginate(
    userId: string,
    filter: ScopedFilter<T>,
    options: { page: number; limit: number; sort: Sort } & SessionOption,
  ): Promise<{ items: T[]; totalCount: number }>;
  count(userId: string, filter: ScopedFilter<T>, options?: SessionOption): Promise<number>;
  /** Sets userId; returns the stored document with its _id. Duplicate keys propagate (use cases recover). */
  insertOne(userId: string, doc: Omit<T, "_id" | "userId">, options?: SessionOption): Promise<T>;
  /** Returns the document after the update, or null if not found/not owned. */
  updateById(userId: string, id: string, update: UpdateFilter<T>, options?: SessionOption): Promise<T | null>;
  /** Claim-once and conditional updates, e.g. { claimed: false } → { claimed: true }. */
  updateOne(
    userId: string,
    filter: ScopedFilter<T>,
    update: UpdateFilter<T>,
    options?: SessionOption & { upsert?: boolean },
  ): Promise<T | null>;
  /** Idempotent bulk upserts (quest sync): each entry's filter is scoped to userId. */
  upsertMany(
    userId: string,
    entries: { filter: ScopedFilter<T>; update: UpdateFilter<T> }[],
    options?: SessionOption,
  ): Promise<void>;
  /** Returns the deleted document so the caller can reverse its effects (step 3.5). */
  deleteById(userId: string, id: string, options?: SessionOption): Promise<T | null>;
  /** Prepends { $match: { userId } }. For records, stats and anything over full history. */
  aggregate<R extends Document>(userId: string, pipeline: Document[], options?: SessionOption): Promise<R[]>;
}

export function userScopedRepository<T extends UserOwnedDoc>(collection: AppCollection): UserScopedRepository<T>;
```

- **`userId` is a string everywhere** (the better-auth id's hex form), audit §3.2 #2.
- **Updates cannot change the owner.** The implementation rejects an update that touches `userId`.
- **Not every collection fits** — these are the named exceptions, and they implement the same rule by hand (every method takes the acting `userId`):

  | Collection | Repository | Why not `UserScopedRepository` |
  |---|---|---|
  | `player_profiles` | `progression/profile.repository.ts` | `_id` *is* the user id; one document per user |
  | `friendships` | `social/friendship.repository.ts` | Two owners; every filter is `$or` on `requesterId`/`receiverId` |
  | `outbox` | `platform/events` | System-owned; no user |

- **Cross-user reads** (a friend's personal records) go through a module function that takes the target ids explicitly, e.g. `training.getPersonalRecordsForUsers(userIds)`. The caller authorizes first (social checks the friendship), and the function name says it is cross-user.

### C4. Events

**Naming:** `<module>.<past-tense fact>`. The payload holds ids and the facts known at emit time, never display data. Listeners read names and avatars when they run.

```ts
// src/server/platform/events/event-map.ts
/** Augmented by each module's events.ts; platform never imports a module. */
export interface EventMap {}
export type EventType = keyof EventMap;

// src/server/progression/events.ts
declare module "@/server/platform/events" {
  interface EventMap {
    "progression.leveled-up": { userId: string; previousLevel: number; newLevel: number };
  }
}
```

**Initial event catalogue:**

| Event | Emitted by (step) | Payload | Listeners |
|---|---|---|---|
| `activity.logged` | training (3.4) | `{ userId, activity: { type: "workout" \| "run"; id }, occurredAt: Date }` | `achievements.evaluate` |
| `activity.reverted` | training (3.5) | `{ userId, activity: { type; id } }` | `achievements.evaluate` (3.5 decides what it changes) |
| `progression.leveled-up` | progression (3.1) | `{ userId, previousLevel, newLevel }` | `achievements.evaluate`, `notification.friend-leveled-up` |
| `achievement.unlocked` | achievements (3.6) | `{ userId, achievementId }` | `notification.achievement-unlocked` |
| `friendship.requested` | social (3.7) | `{ friendshipId, requesterId, receiverId }` | `notification.friend-requested` |
| `friendship.accepted` | social (3.7) | `{ friendshipId, requesterId, receiverId }` | `notification.friend-accepted` |

Until 3.8, the notification listeners call the existing Redis publisher. Step 2.5 migrates the level-up fan-out and achievement evaluation onto the outbox.

**Emit and listen:**

```ts
// src/server/platform/events/emit.ts
/** Writes one outbox document in the caller's transaction; the session is required by type. */
export function emit<K extends EventType>(
  type: K,
  payload: EventMap[K],
  options: { session: ClientSession },
): Promise<ObjectId>;

// src/server/platform/events/listener.ts
export interface Listener<K extends EventType> {
  /** Stable and unique; stored in outbox.completedListeners. Renaming it reruns it on pending rows. */
  name: string;
  event: K;
  /** Must be idempotent: the same event can be delivered more than once. */
  handle(payload: EventMap[K], meta: { eventId: ObjectId; createdAt: Date }): Promise<void>;
}
export function defineListener<K extends EventType>(listener: Listener<K>): AnyListener;
```

- **Event scope.** `emit()` records the new id in the current event scope (an `AsyncLocalStorage` opened by `defineRoute`). Outside a route (cron, scripts, tests) there is no scope, and the row simply waits for a drain.
- **Transaction retries.** Ids from an aborted `withTransaction` attempt are recorded too. They point at rows that were never committed, and the dispatcher skips them.
- **Listener idempotency:**

  | Listener | Mechanism |
  |---|---|
  | Achievement unlocks | Upsert on the unique `(userId, achievementId)` |
  | Notifications | Upsert on the unique `(userId, sourceEventId)`, with `sourceEventId = meta.eventId` |
  | Listeners that emit (achievements → `achievement.unlocked`) | Write and `emit()` in their own transaction |

- **Guarantee:** at-least-once delivery plus idempotent listeners, which is effectively once. Step 2.5's "exactly once" test asserts the *effect* happens once.

### C5. Outbox document and dispatch

```ts
// in schema.ts
export interface OutboxDoc<K extends EventType = EventType> {
  _id: ObjectId;
  type: K;
  payload: EventMap[K];
  status: "pending" | "done" | "dead";
  /** When a drain may next claim it: createdAt at first, then lease expiry or backoff. */
  availableAt: Date;
  attempts: number;
  /** Listener names that have succeeded; a retry skips them. */
  completedListeners: string[];
  lastError: string | null;
  createdAt: Date;
  /** Set when status becomes done or dead. */
  processedAt: Date | null;
}
```

**Indexes:**

| Index | Shape | Purpose |
|---|---|---|
| `idx_outbox_pending` | `{ availableAt: 1 }`, partial `{ status: "pending" }` | Holds only pending rows, typically zero to a handful, so claims stay cheap at any size |
| `idx_outbox_done_ttl` | `{ processedAt: 1 }`, `expireAfterSeconds: 604800`, partial `{ status: "done" }` | Done rows expire after 7 days. Dead rows never expire: they are the record of what failed |

**Tuning** (`OUTBOX_TUNING` in `platform/config`):

| Setting | Value |
|---|---|
| Lease | 2 min |
| Max attempts | 8 |
| Backoff | 1 min × 2^(attempts − 1), capped at 6 h |
| Stragglers per request | 3 |
| Cron time budget | 240 s (`maxDuration` 300) |

**Claim** (atomic, so two instances never take the same row):

```
findOneAndUpdate(
  { <selector>, status: "pending", availableAt: { $lte: now } },
  { $set: { availableAt: now + lease }, $inc: { attempts: 1 } },
  { returnDocument: "after" })
```

**Deliver a claimed row:**

1. For each listener registered for `row.type` and not in `row.completedListeners`, in table order:
   - run it;
   - on success, `$addToSet` its name into `completedListeners`;
   - on failure, record the error and continue with the next listener.
2. Then:

   | Outcome | Update |
   |---|---|
   | All succeeded (or the type has no listeners) | `status: "done"`, `processedAt: now` |
   | A failure, and `attempts >= 8` | `status: "dead"`, `processedAt: now`, `lastError`, and `console.error` |
   | A failure otherwise | `availableAt: now + backoff(attempts)`, `lastError` |

**Who drains:**

1. **The request that emitted.** `defineRoute` → `after(dispatchEvents(ids))`, which:
   - claims each own id by `_id` (an id with no committed row is skipped);
   - then claims up to **3 overdue rows**, oldest `availableAt` first. Stragglers recover only on requests that already do outbox work, and events emitted by listeners in this drain are usually picked up here too.
   - A request that emitted nothing does **zero** outbox queries.
2. **The cron.** `GET /api/cron/outbox-sweep` (`auth: "cron"`, daily on Hobby) claims rows until none remain or the budget runs out, and returns `{ delivered, failed, dead }`. Moving off Hobby would only change the `vercel.json` schedule.
3. **The operator.** `npm run outbox -- --dead` lists dead rows with their `lastError`. `npm run outbox -- --requeue <id>` resets one to `pending`, `availableAt: now`, `attempts: 0`. That's safe because listeners are idempotent and completed listeners are skipped.

### C6. XP ledger and the progression write API

```ts
// in schema.ts
export type XpSourceType = "workout" | "run" | "quest_claim";

export interface XpLedgerDoc {
  _id: ObjectId;
  userId: string;
  sourceType: XpSourceType;
  sourceId: string;        // the workout/run _id, or the user_quests row _id
  amount: number;          // integer >= 0
  occurredAt: Date;        // when the source happened (activity date, claim time)
  createdAt: Date;
}
// unique idx_xpLedger_source { userId: 1, sourceType: 1, sourceId: 1 }; its userId prefix serves the sum

export interface PlayerProfileDoc {
  _id: string;             // the better-auth user id
  totalXp: number;         // cache of the ledger sum; level, in-level xp and xpToNextLevel are computed
  streak: number;
  lastActivityDay: string | null;   // "YYYY-MM-DD" in the user's time zone
  stamina: number;
  lastStaminaUpdate: Date;
  totalWorkouts: number;
  totalDistance: number;   // km
  createdAt: Date;
  updatedAt: Date;
}
```

**Progression's public API (fixed in 3.1; reversal added in 3.5).** All of it is called inside the caller's transaction, and all of it goes through one private XP path (fixes F-15):

```ts
type XpSource = { type: XpSourceType; id: string };

recordActivity(input: {
  userId: string; source: XpSource; xp: number; staminaCost: number;
  totals: { workouts?: number; distanceKm?: number }; occurredAt: Date;
}, session: ClientSession): Promise<{ profile: PlayerProfile; leveledUp: boolean }>;

grantXp(input: { userId: string; source: XpSource; amount: number; occurredAt: Date },
  session: ClientSession): Promise<{ profile: PlayerProfile; leveledUp: boolean }>;

// step 3.5
replaceSourceXp(input: { userId: string; source: XpSource; amount: number;
  totals: { workouts?: number; distanceKm?: number } }, session: ClientSession): Promise<PlayerProfile>;
revokeSource(input: { userId: string; source: XpSource;
  totals: { workouts?: number; distanceKm?: number } }, session: ClientSession): Promise<PlayerProfile>;
```

- **The private XP path:**
  1. Insert the ledger row.
  2. `$inc totalXp` on the profile (`findOneAndUpdate`, `returnDocument: "after"`, upserting a default profile on first touch).
  3. Compare `levelFromTotalXp(after − amount)` with `levelFromTotalXp(after)`, a pure rule.
  4. On a level-up, `emit("progression.leveled-up", …, { session })`.
- **Concurrency.** Two concurrent transactions on one profile hit a write conflict, and `withTransaction` retries one of them. `__v` and both retry loops go (§3.2 #6).
- **Duplicates.** A duplicate ledger source aborts the whole transaction. The activity's `idempotencyKey` already turns a client retry into a replay before that happens.
- **Edit and delete (3.5)** recompute `totalXp` from `aggregate($match userId, $group $sum amount)`, rather than `$inc`-ing a difference. That's exact even if the cache ever drifted, and it makes levelling down fall out of `levelFromTotalXp`.

### C7. Notification document (shape fixed here; module built in 3.8)

```ts
// in schema.ts
export type NotificationDoc = {
  _id: ObjectId;
  userId: string;                         // recipient
  sourceEventId: ObjectId;                // the outbox event that produced it
  actor: { userId: string; name: string; avatar: string } | null;  // snapshotted when written
  createdAt: Date;
  readAt: Date | null;
} & (
  | { type: "friend.requested" | "friend.accepted"; data: { friendshipId: string } }
  | { type: "friend.leveled-up"; data: { newLevel: number } }
  | { type: "achievement.unlocked"; data: { achievementId: string } }
);
```

**Indexes:**

| Index | Shape | Purpose |
|---|---|---|
| `idx_notifications_source` | `{ userId: 1, sourceEventId: 1 }`, unique | Listener idempotency |
| `idx_notifications_feed` | `{ userId: 1, createdAt: -1 }` | The poll and the unread count |
| `idx_notifications_ttl` | `{ createdAt: 1 }`, `expireAfterSeconds: 7776000` | Auto-delete after 90 days |

**Routes (3.8):**

| Route | Contract |
|---|---|
| `GET /api/notifications?since=<ISO>` | `name: "notifications.list"`. Returns `{ items: Notification[]; unreadCount: number }`: items with `createdAt >= since`, newest first, at most 50. Without `since`, the latest 20. The client dedupes by id, since `$gte` can repeat a row |
| `PATCH /api/notifications/read` | `name: "notifications.read"`, `throttle: "standard"`. Body `{ ids: string[] }` (1–50) or `{ all: true }` |

### C8. `schema.ts` layout

`src/server/platform/database/schema.ts` is the one place to read the data model. It has one responsibility, so it stays one file even past ~400 lines (the size rule splits only on two responsibilities). Top to bottom:

```ts
// 1. Names — fixed in code; the ten MONGODB_*_COLLECTION env vars are deleted.
export const COLLECTIONS = {
  // better-auth owned: named here, never validated or indexed by us
  user: "user", session: "session", account: "account", verification: "verification",
  // app owned
  playerProfiles: "player_profiles",
  workouts: "workouts",
  runs: "runs",
  customExercises: "custom_exercises",
  workoutTemplates: "workout_templates",
  userQuests: "user_quests",
  userAchievements: "user_achievements",
  friendships: "friendships",
  xpLedger: "xp_ledger",
  outbox: "outbox",
  notifications: "notifications",
} as const;
export type AppCollection = keyof typeof COLLECTIONS;

// 2. Document types — one per collection, in the order above (WorkoutDoc, RunDoc, …, OutboxDoc).

// 3. Per-collection schema
interface CollectionSchema {
  indexes: (IndexDescription & { name: string })[];   // every index named
  validator?: { $jsonSchema: Document };              // app-owned collections only
}
export const SCHEMA: Record<Exclude<AppCollection, "user" | "session" | "account" | "verification">, CollectionSchema>;

// 4. Indexes to drop (each with the step that retired it)
export const RETIRED_INDEXES: { collection: AppCollection; name: string }[];

// 5. applySchema(db): create missing collections → collMod validators → createIndexes → drop RETIRED_INDEXES
```

- **Growth.** `schema.ts` describes only collections that exist. Step 2.1 covers today's; each later step adds its own (`outbox` in 2.5, `player_profiles` and `xp_ledger` in 3.1, `notifications` in 3.8).
- **Validators** use `validationAction: "error"` and `validationLevel: "moderate"`: new writes must conform, and documents that already break the rules don't block their own updates during a migration. Each validator requires the fields every document has and pins their BSON types (`userId: string`, dates as `date`), which would have caught `workout_templates.createdAt` stored as a string. In 2.1 they describe **today's** write shapes (that `createdAt` stays a string), so the refactor changes no behaviour; the step that owns each collection tightens its validator together with the code and a backfill. Better-auth's collections get none, and neither do `quest_templates` and `achievements`, which retire in 3.2.
- **Drift check.** The TypeScript types and the validators are written by hand. The integration suite is the drift check: `vitest.global-setup.ts` runs `applySchema()` against the in-memory replica set, so every test write passes through the validators.
- **Retired indexes in 2.1** (Phase 0 carry-over):
  - `friendships.idx_friendships_requester_receiver` (with the matching `requesterId` branch in `sendFriendRequest`);
  - `user_achievements.idx_userAchievements_userId`;
  - `custom_exercises.idx_customExercises_userId` (each is a prefix of a unique index).
- **Collection rename in 2.1.** `env.ts` defaults `MONGODB_CUSTOM_EXERCISES_COLLECTION` to `customExercises`, so that is the effective name unless Vercel overrides it. Migration `002` renames `customExercises` → `custom_exercises` when the old name exists and the new one doesn't (idempotent). Step 2.1 first checks which name production actually uses.
- **Collections retiring in 3.2:** `quest_templates` and `achievements` (and their indexes).

### C9. `runtime.ts`: the composition root

`src/server/runtime.ts` is the only file that sees every module. Only `src/app/**` may import it (G6).

```ts
import { createDefineRoute } from "@/server/platform/http";
import { createDispatcher } from "@/server/platform/events";
import { achievementListeners } from "@/server/achievements";
import { notificationListeners } from "@/server/notification";

export const LISTENERS = [...achievementListeners, ...notificationListeners] as const;
const dispatcher = createDispatcher(LISTENERS);

export const defineRoute = createDefineRoute({ dispatchEvents: dispatcher.dispatchOwnAndOverdue });
export const drainOutbox = dispatcher.drainUntilEmpty;   // the cron route
```

**Until steps 3.6 and 3.8** build those modules, step 2.5 defines the two listeners in `runtime.ts` itself, as thin adapters over the old `evaluateAchievements` and `notifyFriendsLevelUp` services: `server → lib` imports are allowed, and only `lib → server` is restricted (G3). Old `src/lib/services` code calls `emit()` under the G3 strangler exemption.

**Chosen over Next's `instrumentation.ts` `register()` hook.** Registration through a startup hook fails silently if the hook doesn't run (in a test, a script, or a misconfigured runtime). Explicit wiring is traceable, and tests build a dispatcher with exactly the listeners they need.

---

## Testing Strategy (for the implementing steps)

Each step follows AGENTS.md TDD: integration first, against the in-memory replica set with `applySchema()` applied.

| Step | Required tests |
|---|---|
| 2.1 | Migration runner: a migration runs once and is recorded; a rerun is a no-op. `applySchema` is idempotent. One deliberate boundary violation fails lint (proved once, not committed) |
| 2.2 | The route-table test (C2). Existing route tests pass unchanged. Malformed JSON → 400. Cron bearer mismatch → 401 |
| 2.3 | Over-limit → 429 with `Retry-After`. A limiter failure lets the request through (Upstash mocked: a true external boundary) |
| 2.5 | `emit` in an aborted transaction leaves no row. A failing listener retries alone, while completed ones are skipped. An expired lease is reclaimable. Eight failures → `dead`. "Kill dispatch after commit, then sweep" delivers the effect once. A request that emits nothing makes no outbox query |
| 3.1 | Every existing XP, level, streak and stamina outcome. Ledger row per grant. Concurrent grants on one profile both land |
| 3.5 | Edit and delete recompute `totalXp` and level (including level-down); backfill is idempotent |

**Vitest setup changes (2.1):**
- Alias `server-only` to an empty module. The package throws outside the react-server condition.
- Drop the collection-name env vars from `vitest.global-setup.ts`.

## Out of Scope

- **Edit/delete edge cases** (keep unlocked achievements? claimed quests whose progress no longer holds? level-down notice?). Step 3.5's brainstorm owns them.
- **better-auth endpoint rate limiting.** Its built-in limiter uses per-instance memory on serverless. Moving it to Redis secondary storage is a separate security follow-up.
- **Front-end hooks and query keys** (4.1), and page component moves (4.2).
- **Alerting on dead outbox rows.** The `npm run outbox` script and the cron's counts are enough at this size.

## Risks

- **Build-time migrations on preview deploys.** `npm run build` runs `migrate-db.ts`. If preview deployments share the production `MONGODB_DB`, a PR preview migrates production data before merge. Step 2.1 must confirm previews use a separate database, or skip migrations when `VERCEL_ENV !== "production"`.
- **Type augmentation discipline.** `EventMap` augmentation only works if every `events.ts` is in the TypeScript program. They are, since `tsc` includes `src/**`, but an event whose `events.ts` is never imported at runtime still type-checks. That's harmless, because emitters import their own types.

## Changes to the Audit

- **§6** carries a note that this spec amends §6.1 (adds `src/shared/`, `runtime.ts`), §6.2 (schemas location) and §6.4 (`timeZone` stays on `user`; `lastActivityDay`; `schema_migrations`, `notifications` shapes).
- **§7.2** is marked settled, pointing to D1–D8.
- **§8.2** marks step 1.1 Done and records the scope changes in D4. The 2.1, 2.2, 2.5, 3.1, 3.5 and 3.8 kickoff prompts point at the relevant decisions. The module **order is unchanged**.

[[Specs Index]]
