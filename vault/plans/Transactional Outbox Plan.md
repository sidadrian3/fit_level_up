# Transactional Outbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Side effects are written as outbox rows in the caller's transaction, delivered right after the response, and recovered by one generic daily sweep, so a function killed after commit delays an effect but never loses it.

**Architecture:** `src/server/platform/events` holds `emit()` (one insert with the caller's session), an `AsyncLocalStorage` event scope opened by `defineRoute`, and a `createDispatcher(listeners)` that claims rows atomically with a lease, runs the listeners that haven't succeeded yet, and backs off or kills failing rows. `runtime.ts` owns the listener table (thin adapters over today's services), wires `dispatchOwnAndOverdue` into `defineRoute` and exposes `drainUntilEmpty` to the cron route.

**Tech Stack:** Next.js 16 route handlers (`after()` from `next/server`), MongoDB 7 driver (in-memory replica set in tests), Vitest, Node `AsyncLocalStorage`.

**Spec:** [[Transactional Outbox Design Spec]] (implements C4, C5, C9 of [[Architecture Overhaul Design Spec]]).

## Global Constraints

- Readable and simple first: plain exported functions, no classes, no registry, short files. Comments only for a non-obvious why.
- `OUTBOX_TUNING`: `leaseMs: 2 * 60_000`, `maxAttempts: 8`, `backoffBaseMs: 60_000`, `backoffCapMs: 6 * 3_600_000`, `overduePerRequest: 3`, `cronBudgetMs: 240_000`.
- Backoff after a failed attempt: `min(backoffBaseMs × 2^(attempts − 1), backoffCapMs)`.
- Indexes, verbatim: `idx_outbox_pending` `{ availableAt: 1 }` partial `{ status: "pending" }`, and `idx_outbox_done_ttl` `{ processedAt: 1 }`, `expireAfterSeconds: 604800`, partial `{ status: "done" }`.
- Event names and payloads, verbatim:
  - `"activity.logged": { userId: string; activity: { type: "workout" | "run"; id: string }; occurredAt: Date }`;
  - `"progression.leveled-up": { userId: string; previousLevel: number; newLevel: number }`.
- Listener names: `achievements.evaluate` (on both events) and `notification.friend-leveled-up`. Names are unique per event type.
- `lastError` format: `"<listener name>: <message>"`, several joined with `"; "`. A non-`Error` throw uses `String(err)`.
- Cron: `GET /api/cron/outbox-sweep`, route name `cron.outbox-sweep`, `auth: "cron"`, `maxDuration = 300`, `dynamic = "force-dynamic"`, schedule `0 3 * * *`. Response `{ delivered, failed, dead }`.
- Import platform areas through their entry (`@/server/platform/events`, …); `event-map.ts` imports nothing; `schema.ts` must not import `platform/events` (G1 cycle).
- AGENTS.md rules apply: no `any`, integration tests against the replica set (mock only Redis/SSE and `after()`), clean up test data, and **every test that touches `outbox` clears it first** (`deleteMany({})`), because other tests' drains claim overdue rows.
- Commit messages carry no `Co-Authored-By` trailer.

## Review Focus

- **A listener that throws synchronously** (a non-`async` `handle` that throws before returning a promise) must count as that listener's failure, not crash the drain. Pinned in Task 2.
- **A non-`Error` throw** (`throw "boom"`) must still produce a string `lastError` (`"t.fail: boom"`). Pinned in Task 2.
- **A row whose type has no listeners** must become `done`, not loop. Pinned in Task 2.
- **A handler that returns its own `Response`** after emitting must still dispatch on a 2xx. Pinned in Task 3.
- **A listener failure must not reject `dispatchOwnAndOverdue`**, since it runs in `after()` with nothing to catch it. Pinned in Task 2.

---

### Task 1: Outbox collection, event types and `emit` (layer: platform)

**Files:**
- Create: `src/server/platform/config/outbox.ts`, `src/server/platform/events/{index.ts,event-map.ts,event-scope.ts,emit.ts}`
- Modify: `src/server/platform/config/index.ts` (export `OUTBOX_TUNING`), `src/server/platform/database/schema.ts` (`COLLECTIONS.outbox`, `OutboxDoc`, `SCHEMA.outbox`), `src/server/platform/database/index.ts` (export `OutboxDoc` type)
- Test: `src/server/platform/events/__tests__/outbox.test.ts`

**Builds on:** `getCollection`, the `objectSchema`/`string`/`date`/… helpers in `schema.ts`, `applySchema` (run by `vitest.global-setup.ts`, so the collection and validator exist in tests), `clientPromise` for sessions.

**Interfaces:**
- Produces:
  - `OutboxDoc<T extends string = string, P = Document>` (shape in spec "Document and indexes"; `_id?: ObjectId` like the other docs).
  - `export interface EventMap {}` and `export type EventType = keyof EventMap` (`event-map.ts`).
  - `collectEmittedEvents<T>(ids: ObjectId[], fn: () => Promise<T>): Promise<T>` and `recordEmitted(id: ObjectId): void` (`event-scope.ts`, one `AsyncLocalStorage<ObjectId[]>`; `recordEmitted` is a no-op outside a scope).
  - `emit<K extends EventType>(type: K, payload: EventMap[K], options: { session: ClientSession }): Promise<ObjectId>`.
  - `index.ts` starts with `import "server-only"` and exports the above (Task 2 adds more).

- [ ] **Step 1: Write the failing tests** in `outbox.test.ts`. At the top, a test-only augmentation:

```ts
declare module "@/server/platform/events" {
  interface EventMap { "outbox-test.pinged": { n: number } }
}
```

  `beforeEach` clears `outbox`. Tests:
  - `"emit in a committed transaction writes one pending row"`: `withTransaction(s => emit("outbox-test.pinged", { n: 1 }, { session: s }))` → one row with `type`, `payload: { n: 1 }`, `status: "pending"`, `attempts: 0`, `completedListeners: []`, `lastError: null`, `processedAt: null`, and `availableAt` equal to `createdAt`.
  - `"emit in an aborted transaction leaves no row"`: emit, then throw inside the callback → the transaction rejects and `countDocuments({})` is 0.
  - `"emit records its id in the current event scope"`: `collectEmittedEvents(ids, …)` around a committed emit → `ids` holds the returned id. Outside a scope, emit still succeeds.
- [ ] **Step 2: Run** `npx vitest run src/server/platform/events` → FAIL (module not found).
- [ ] **Step 3: Implement** the files listed. `SCHEMA.outbox` has the two indexes from Global Constraints and a validator requiring every field except `_id`. `lastError` is `{ bsonType: ["string", "null"] }`, `processedAt` is `{ bsonType: ["date", "null"] }`, `status` is an enum and `payload` is `object`. `emit` sets `availableAt = createdAt = new Date()`.
- [ ] **Step 4: Run** the test file, then `npm run typecheck` and `npx eslint src/server/platform` → PASS. Also run `npx depcruise src --config .dependency-cruiser.cjs --ignore-known`, which must report no cycle.
- [ ] **Step 5: Commit** `feat(events): outbox collection, typed EventMap and transactional emit`

### Task 2: Dispatcher: claim, deliver, back off, dead (layer: platform)

**Files:**
- Create: `src/server/platform/events/{listener.ts,dispatcher.ts}`
- Modify: `src/server/platform/events/index.ts`
- Test: `src/server/platform/events/__tests__/outbox.test.ts`

**Builds on:** Task 1, `OUTBOX_TUNING`.

**Interfaces:**
- Consumes: `emit`, `EventMap`, `EventType`, `OutboxDoc`.
- Produces:
  - `Listener<K>` (`name`, `event`, `handle(payload: EventMap[K], meta: { eventId: ObjectId; createdAt: Date }): Promise<void>`), `type AnyListener = Listener<EventType>`, and `defineListener<K extends EventType>(listener: Listener<K>): AnyListener` (the one cast).
  - `createDispatcher(listeners: readonly AnyListener[], options?: { now?: () => Date })`, which returns `{ dispatchOwnAndOverdue(ids: ObjectId[]): Promise<void>; drainUntilEmpty(options?: { budgetMs?: number }): Promise<{ delivered: number; failed: number; dead: number }> }`. It throws `Error("Duplicate listener <event>/<name>")` at construction.

- [ ] **Step 1: Write the failing tests** (same file). Seed rows with committed `emit` calls. Listeners are `defineListener({ name, event: "outbox-test.pinged", handle: vi.fn(...) })`.
  - `"delivers an emitted row once and marks it done"`: `dispatchOwnAndOverdue([id])` → the handler is called once with `({ n: 1 }, { eventId: id, createdAt })`. The row is `status: "done"`, `attempts: 1`, `completedListeners: ["t.ok"]`, and `processedAt` is set. A second `dispatchOwnAndOverdue([id])` doesn't call it again.
  - `"skips an id with no committed row"`: `dispatchOwnAndOverdue([new ObjectId()])` resolves, and no handler runs.
  - `"retries only the failing listener"`: listener `t.ok` succeeds; `t.flaky` rejects once, then succeeds.
    - The first drain leaves the row `pending`, with `completedListeners: ["t.ok"]` and `lastError: "t.flaky: <message>"`. `availableAt` is `now + 60_000` (attempts 1).
    - A dispatcher with `now` 61 s later drains it: `t.ok` is called once in total, `t.flaky` twice, and the row is `done`.
  - `"backs off exponentially"`: a row set to `attempts: 3` whose listener fails is claimed (attempts 4) and gets `availableAt = now + 480_000`. With `maxAttempts` 8 the largest backoff is 64 min, so the 6 h cap is never reached and gets no test; it stays in the formula because C5 specifies it.
  - `"an expired lease is reclaimable, a live one is not"`: set a row to `availableAt: now + 2 min, attempts: 1` (as a crashed claim leaves it). `drainUntilEmpty()` at real now → `delivered: 0`. A dispatcher with `now` 3 min later → `delivered: 1`.
  - `"goes dead after the eighth failed attempt"`: a row at `attempts: 7`, and a listener that always throws `new Error("boom")` → `drainUntilEmpty()` returns `{ delivered: 0, failed: 0, dead: 1 }`. The row is `status: "dead"`, `attempts: 8`, `lastError: "t.fail: boom"`, and `processedAt` is set. `console.error` is called (spy).
  - `"two concurrent drains deliver a row once"`: `Promise.all([d.drainUntilEmpty(), d.drainUntilEmpty()])` → the handler is called once and the summed `delivered` is 1.
  - Review Focus: `"a synchronous throw counts as that listener's failure"` (`handle: () => { throw new Error("sync") }` typed via `defineListener`); `"a non-Error throw becomes a string lastError"` (`throw "boom"` → `"t.fail: boom"`); `"a type with no listeners is marked done"`; `"dispatchOwnAndOverdue resolves when a listener fails"`.
  - `"also drains up to 3 overdue rows"`: 4 committed rows, then one more emitted as the own row → `dispatchOwnAndOverdue([ownId])` leaves the own row and 3 overdue rows done, and 1 still pending.
  - `"rejects a duplicate listener name for one event"`: `createDispatcher([a, a])` throws, while the same name on two different events is allowed (use a second test event `"outbox-test.ponged"`).
- [ ] **Step 2: Run** `npx vitest run src/server/platform/events` → the new tests FAIL.
- [ ] **Step 3: Implement** `listener.ts` and `dispatcher.ts` to spec "Dispatcher".
  - The `now` option defaults to `() => new Date()`.
  - Private helpers in `dispatcher.ts`: `claim(selector)`, `deliver(row)` and `backoffMs(attempts)`.
  - Wrap each listener call as `await Promise.resolve().then(() => listener.handle(...))` inside `try`, so a synchronous throw is caught too.
  - `dispatchOwnAndOverdue` wraps its body in `try/catch` and logs with `console.error("[Outbox] dispatch failed", err)`.
  - `drainUntilEmpty` checks the budget with `Date.now()` (wall time, not `now()`).
- [ ] **Step 4: Run** the test file, then typecheck and eslint on the changed files → PASS.
- [ ] **Step 5: Commit** `feat(events): outbox dispatcher with leases, per-listener retry, backoff and dead rows`
### Task 3: `defineRoute` dispatches emitted events; `runtime.ts` wiring (layer: route platform)

**Files:**
- Modify: `src/server/platform/http/define-route.ts`, `src/server/runtime.ts`
- Test: `src/server/platform/http/__tests__/define-route.test.ts`

**Builds on:** Task 1 `collectEmittedEvents`, Task 2 `createDispatcher`. The global `after()` mock in `vitest.setup.ts` runs the task immediately.

**Interfaces:**
- Consumes: `collectEmittedEvents`, `createDispatcher`, `defineListener`.
- Produces:
  - `DefineRouteDeps.dispatchEvents: (ids: ObjectId[]) => Promise<void>` (required).
  - `runtime.ts` exports `defineRoute` (as before) and `drainOutbox` (`dispatcher.drainUntilEmpty`). Its `LISTENERS` array is empty in this task.

- [ ] **Step 1: Write the failing tests.**
  - `setup()` gains `const dispatchEvents = vi.fn(async () => {})`, passed into `createDefineRoute` and returned.
  - New `describe("event dispatch")`, with handlers that call `recordEmitted(new ObjectId())` from `@/server/platform/events` to stand in for an emit (no DB needed):
    - `"dispatches the ids a 2xx handler emitted"` → `dispatchEvents` is called once with `[id]`.
    - `"does not dispatch when the handler throws"` (`throw new ConflictError("x")` after recording) → 409 and not called.
    - `"does not dispatch when nothing was emitted"` → not called.
    - `"dispatches when the handler returns its own Response"` (`new Response(null, { status: 204 })`) → called.
- [ ] **Step 2: Run** `npx vitest run src/server/platform/http` → FAIL.
- [ ] **Step 3: Implement.**
  - In `define-route.ts`, `route` runs its existing body via `collectEmittedEvents(ids, …)` to get the `Response`. Then `if (response.status < 400 && ids.length > 0) after(() => deps.dispatchEvents(ids))`, and return the response.
  - In `runtime.ts`, use `const LISTENERS: AnyListener[] = []`, `const dispatcher = createDispatcher(LISTENERS)`, and add `dispatchEvents: dispatcher.dispatchOwnAndOverdue` to the deps. Export `drainOutbox`.
- [ ] **Step 4: Run** `npx vitest run src/server/platform src/app/api` (route tests must pass unchanged), then typecheck and eslint → PASS.
- [ ] **Step 5: Commit** `feat(http): defineRoute dispatches the events a request emitted after the response`

### Task 4: Emit from the old services; listeners in `runtime.ts` (layers: service, composition root)

**Files:**
- Create: `src/server/training/events.ts`, `src/server/progression/events.ts` (the augmentations, verbatim from the spec, each ending in `export {}`)
- Modify: `src/lib/services/workouts/log-workout.ts`, `src/lib/services/runs/log-run.ts`, `src/lib/services/users/user-state.service.ts`, `src/lib/services/users/grant-user-xp.ts`, `src/server/runtime.ts`
- Test: `src/lib/services/__tests__/log-workout.test.ts`, `src/lib/services/__tests__/log-run.test.ts`, new `src/lib/services/__tests__/grant-user-xp.test.ts`

**Builds on:** Task 1 `emit`, Task 3 `LISTENERS`; `evaluateAchievements(userId)`, `notifyFriendsLevelUp(userId, newLevel)`.

**Interfaces:**
- Consumes: `emit`, `defineListener`.
- Produces:
  - `UserStateService.applyActivity(userId: string, payload: ActivityPayload, session: ClientSession)`.
  - `grantUserXP(userId: string, amount: number, session: ClientSession)`.
  - Neither has a retry loop any more: a caught `OptimisticLockError` gets `errorLabels = ["TransientTransactionError"]` and is rethrown.
  - `LISTENERS` holds the three listeners from spec "runtime.ts". Each `handle` returns `Promise<void>`, so wrap `evaluateAchievements` as `async ({ userId }) => { await evaluateAchievements(userId); }`.

- [ ] **Step 1: Write the failing tests** (each file clears `outbox` in `beforeEach`).
  - `log-workout.test.ts`: `"emits activity.logged with the workout"` → after `logWorkout`, one row `{ type: "activity.logged", payload: { userId, activity: { type: "workout", id: workout.id } } }`, where `payload.occurredAt` is a `Date`. `"a replay emits nothing more"` → same key and body twice gives exactly one `activity.logged` row.
  - `log-run.test.ts`: the same two, with `type: "run"`.
  - `grant-user-xp.test.ts`: seed a user at `level: 1, xp: 450, xpToNextLevel: 500`.
    - `"emits progression.leveled-up when the grant crosses a level"`: `grantUserXP(userId, 100, session)` inside `withTransaction` writes one row with `payload { userId, previousLevel: 1, newLevel: 2 }`.
    - `"emits nothing below the threshold"`: `grantUserXP(userId, 10, session)` writes no row.
    - `"emits nothing when the transaction aborts"`.
- [ ] **Step 2: Run** those three files → FAIL.
- [ ] **Step 3: Implement.**
  - Remove every `after(...)` and its `next/server` import from the four services. Delete the `!result.replayed` blocks and the `evaluateAchievements`/`notifyFriendsLevelUp` imports there.
  - Emit right after the activity insert (training) and after the user update (progression), passing `{ session }`.
  - Make `session` required and collapse the retry loops.
  - Fill `LISTENERS` in `runtime.ts`.
- [ ] **Step 4: Run** `npm run typecheck`, then `npx vitest run src/lib/services src/app/api src/server` and eslint on the changed files → PASS.
- [ ] **Step 5: Commit** `feat(events): emit activity and level-up events from the services and wire their listeners`

### Task 5: Generic outbox sweep replaces the achievements sweep; `npm run outbox` (layers: route, script, cleanup)

**Files:**
- Create: `src/app/api/cron/outbox-sweep/route.ts`, `src/app/api/cron/__tests__/outbox-sweep.test.ts`, `src/scripts/outbox.ts`
- Modify: `vercel.json`, `package.json` (`"outbox": "tsx --conditions=react-server --env-file=.env.local src/scripts/outbox.ts"`), `src/lib/data/user-db.ts` (delete `getRecentlyActiveUsers`), `.dependency-cruiser-known-violations.json` (delete the `notify-friends-level-up ↔ user-state.service` cycle entry, if depcruise no longer reports it)
- Delete: `src/app/api/cron/achievements-sweep/route.ts`, `src/app/api/cron/__tests__/achievements-sweep.test.ts`, `src/lib/services/achievements/sweep-locked-achievements.ts`, `src/lib/services/__tests__/sweep-locked-achievements.test.ts`

**Builds on:** Task 3 `drainOutbox`, Task 4 listeners; the workouts route test's setup (auth and limiter mocks, user seeding).

**Interfaces:**
- Consumes: `drainOutbox(): Promise<{ delivered; failed; dead }>`.
- Produces: `GET /api/cron/outbox-sweep`.

- [ ] **Step 1: Write the failing test** `outbox-sweep.test.ts`.
  - Mocks at file level:
    - `next/server` with `after: () => {}` (dispatch killed after commit; keep `importOriginal` for `NextResponse`);
    - `@/lib/auth/auth-helpers`;
    - `@/server/platform/http/rate-limiter` (allow);
    - `@/lib/sse/sse-publisher` with `publishToMany: vi.fn(async () => {})`.
  - `beforeEach` clears `outbox`. It seeds a user at `level: 1, xp: 499, xpToNextLevel: 500`, an accepted friendship with a second seeded user (`pairKey` as `send-friend-request` builds it), and an achievement definition `{ id: "outbox_sweep_first_workout", condition: { metric: "total_workouts", target: 1 }, … }`. `afterEach` deletes them.
  - Tests:
    - `"returns 401 without a bearer token"` and `"returns 401 with the wrong token"` (ported).
    - `"delivers events from a killed dispatch exactly once"`:
      - `POST /api/workouts` with a valid body and an `Idempotency-Key` → 201, and `outbox` holds 2 `pending` rows (`activity.logged`, `progression.leveled-up`).
      - `GET` the sweep with the bearer → 200 `{ delivered: 2, failed: 0, dead: 0 }`. `user_achievements` has exactly one `outbox_sweep_first_workout` row for the user. `publishToMany` was called once, with `[friendId]` and a `friend_level_up` event with `newLevel: 2`.
      - A second sweep → `{ delivered: 0, failed: 0, dead: 0 }`, with the counts and calls unchanged.
- [ ] **Step 2: Run** it → FAIL (route missing).
- [ ] **Step 3: Implement.**
  - The route follows spec "Cron route". `vercel.json` gets the new path.
  - The script parses `process.argv`:
    - `--dead` prints rows via `console.table`.
    - `--requeue <id>` uses `parseObjectId`, updates `{ _id, status: "dead" }`, and prints `"Requeued <id>"` or `"No dead row <id>"`.
    - Anything else prints the usage.
    - It closes the client at the end.
  - Delete the listed files and `getRecentlyActiveUsers`.
- [ ] **Step 4: Run** `npm run typecheck`, then `npx vitest run src/app/api/cron src/lib`, `npx eslint` on the changed files, and `npx depcruise src --config .dependency-cruiser.cjs --ignore-known` → PASS, with no stale reference to the deleted files (`grep -rn "achievements-sweep\|sweepLockedAchievements\|getRecentlyActiveUsers" src vercel.json` is empty).
- [ ] **Step 5: Commit** `feat(cron): generic outbox sweep replaces the achievements sweep, plus npm run outbox`

[[Plans Index]]
