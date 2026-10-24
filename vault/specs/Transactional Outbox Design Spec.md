# Transactional Outbox Design Spec

**Status:** Approved, 2026-10-24, after a brainstorm and grilling pass. Step 2.5 in [[Architecture Overhaul Audit]]: implements D6a, C4, C5 and C9 of [[Architecture Overhaul Design Spec]], with the amendments listed under Decisions. Type API (no visual surface), so the design critique (Step 3.5) does not apply.

Read spec C4 (events), C5 (outbox document and dispatch) and C9 (`runtime.ts`) first. This spec restates only what the build needs to settle beyond them.

## Problem Statement

Two side effects run as fire-and-forget `after()` calls from inside the old services:

- **Achievement evaluation**, after `logWorkout` and `logRun`. If the function dies after commit, the daily `achievements-sweep` re-evaluates every user active in the last 72 hours.
- **The friend level-up fan-out**, from `UserStateService.applyActivity` and `grantUserXP`. Nothing recovers it.

Each recovery path is bespoke, and one effect has none. Both `after()` calls also sit inside a `withTransaction` callback, so a transaction retry registers the side effect twice, including once for an attempt that never committed.

## Solution

`src/server/platform/events` provides a typed `emit()` that inserts one `outbox` row in the caller's transaction. `defineRoute` collects the ids a request emitted and, after a successful response, hands them to the dispatcher in `after()`. The dispatcher runs the listeners from the table in `runtime.ts`. A daily cron, `/api/cron/outbox-sweep`, delivers whatever is still pending. Rows record attempts, completed listeners and the last error, back off exponentially, and go `dead` after 8 attempts. `npm run outbox` lists dead rows and requeues one.

The old services stop calling `after()`. `logWorkout` and `logRun` emit `activity.logged`, and the two level-up paths emit `progression.leveled-up`. The achievements-specific sweep is deleted.

The guiding rule for the build is **readable and simple**: plain functions, no classes, no registry, and a handful of short files.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Achievement evaluation listens to **both** `activity.logged` and `progression.leveled-up`, as the C4 catalogue lists | A quest-claim level-up logs no activity. Without the second subscription, a level achievement earned that way stays locked until the next activity, now that the old sweep is gone. A workout that levels up evaluates twice, which is harmless: unlocks are upserts |
| 2 | The friend level-up listener keeps calling the Redis SSE publisher, and is **not** idempotent. Accepted until 3.8 | A crash between the push and recording the listener as done makes the sweep push again: one duplicate toast, rarely. Step 3.8 replaces SSE with the inbox and its `(userId, sourceEventId)` upsert. Adding a Redis dedupe key now would be code that 3.8 deletes |
| 3 | `OutboxDoc` in `schema.ts` is generic over `type` and `payload` (`OutboxDoc<T extends string = string, P = Document>`). `platform/events` narrows it to `EventMap`. **Amends** C5's `OutboxDoc<K extends EventType>` | `schema.ts` importing `EventMap` makes `database → events → database` a cycle, which G1 rejects (dependency-cruiser counts type-only imports). The document shape still lives in `schema.ts` |
| 4 | Listener names are unique **per event type**, so `achievements.evaluate` can listen to two events. `createDispatcher` throws on a duplicate `(event, name)` pair. **Amends** C4's "unique" | `completedListeners` belongs to one row, and a row has one type, so per-event uniqueness is what correctness needs. The C4 catalogue already uses one name on two events |
| 5 | `session` becomes **required** on `UserStateService.applyActivity` and `grantUserXP`. Their non-transaction retry loops are deleted | `emit` requires a session, and every caller already passes one. With a required session, the loop's non-session branch is dead code. The optimistic-lock error is still labelled `TransientTransactionError` so `withTransaction` retries it. Step 3.1 removes `__v` entirely |
| 6 | Event types are declared in their final homes: `src/server/training/events.ts` (`activity.logged`) and `src/server/progression/events.ts` (`progression.leveled-up`). Each holds only the `declare module` augmentation | They move nowhere later. The emitters are old `src/lib` services (the G3 strangler exemption), and they need only the global type, not an import |
| 7 | The dispatcher takes an injectable clock, `createDispatcher(listeners, { now })` | The lease-expiry and backoff tests need time to move without a module-level clock mock. Production passes nothing and gets `() => new Date()` |
| 8 | The cron route answers `{ delivered, failed, dead }` (C5) instead of the old `{ success, processed, errors }` | Vercel Cron reads only the status. The counts are what an operator wants |
| 9 | `npm run outbox` is a script that queries the collection directly, with no service layer and no test | It's an operator tool with two one-line queries, in the same style as the migration scripts |

## Contract

### Files

```
src/server/platform/
  config/outbox.ts                 OUTBOX_TUNING (exported from config/index.ts)
  events/
    index.ts                       "server-only"; exports EventMap, EventType, emit, defineListener,
                                   AnyListener, createDispatcher, collectEmittedEvents
    event-map.ts                   the empty EventMap interface and EventType; imports nothing
    event-scope.ts                 AsyncLocalStorage<ObjectId[]>: collectEmittedEvents(ids, fn), recordEmitted(id)
    emit.ts                        emit()
    listener.ts                    Listener<K>, AnyListener, defineListener()
    dispatcher.ts                  createDispatcher(): claim, deliver, dispatchOwnAndOverdue, drainUntilEmpty
  database/schema.ts               + outbox collection, OutboxDoc, its indexes and validator
  http/define-route.ts             + dispatchEvents dependency, event scope, after()
src/server/training/events.ts      augments EventMap with activity.logged
src/server/progression/events.ts   augments EventMap with progression.leveled-up
src/server/runtime.ts              LISTENERS table, dispatcher, defineRoute wiring, drainOutbox
src/app/api/cron/outbox-sweep/route.ts
src/scripts/outbox.ts              npm run outbox -- --dead | --requeue <id>
```

### Tuning

```ts
// src/server/platform/config/outbox.ts
export const OUTBOX_TUNING = {
  leaseMs: 2 * 60_000,
  maxAttempts: 8,
  backoffBaseMs: 60_000,          // 1 min × 2^(attempts − 1)
  backoffCapMs: 6 * 3_600_000,    // capped at 6 h
  overduePerRequest: 3,
  cronBudgetMs: 240_000,          // the route's maxDuration is 300
} as const;
```

### Document and indexes

```ts
// in schema.ts
export type OutboxDoc<T extends string = string, P = Document> = {
  _id?: ObjectId;
  type: T;
  payload: P;
  status: "pending" | "done" | "dead";
  availableAt: Date;
  attempts: number;
  completedListeners: string[];
  lastError: string | null;
  createdAt: Date;
  processedAt: Date | null;
};
```

- `COLLECTIONS.outbox = "outbox"`.
- Indexes, both from C5:
  - `idx_outbox_pending`: `{ availableAt: 1 }`, partial `{ status: "pending" }`.
  - `idx_outbox_done_ttl`: `{ processedAt: 1 }`, `expireAfterSeconds: 604800`, partial `{ status: "done" }`.
- Validator: requires every field except `_id`.
  - `type` is a string, `payload` an object, `status` an enum, `availableAt` and `createdAt` dates, `attempts` a number, `completedListeners` an array.
  - `lastError` is a string or null; `processedAt` is a date or null.

### Events

```ts
// src/server/training/events.ts
declare module "@/server/platform/events" {
  interface EventMap {
    "activity.logged": { userId: string; activity: { type: "workout" | "run"; id: string }; occurredAt: Date };
  }
}

// src/server/progression/events.ts
declare module "@/server/platform/events" {
  interface EventMap {
    "progression.leveled-up": { userId: string; previousLevel: number; newLevel: number };
  }
}
```

### Emit and listen

```ts
export function emit<K extends EventType>(type: K, payload: EventMap[K], options: { session: ClientSession }): Promise<ObjectId>;

export interface Listener<K extends EventType> {
  name: string;   // unique per event type (Decision 4)
  event: K;
  handle(payload: EventMap[K], meta: { eventId: ObjectId; createdAt: Date }): Promise<void>;
}
export type AnyListener = Listener<EventType>;
export function defineListener<K extends EventType>(listener: Listener<K>): AnyListener;
```

- `emit` inserts the row with `status: "pending"`, `availableAt = createdAt = now`, `attempts: 0`, `completedListeners: []`, `lastError: null` and `processedAt: null`, passing `{ session }`. It then calls `recordEmitted(id)`, which does nothing outside a scope.
- `defineListener` is the one place the per-event payload type is widened (a single cast), so the dispatcher handles a uniform list without casts.

### `defineRoute` changes

- `DefineRouteDeps` gains `dispatchEvents: (ids: ObjectId[]) => Promise<void>`.
- The route body runs inside `collectEmittedEvents(ids, …)`.
- When the final response has a status below 400 and `ids` is non-empty, it calls `after(() => deps.dispatchEvents(ids))`.
- A request that emitted nothing calls neither `after` nor the dispatcher, so it makes **zero** outbox queries.

### Dispatcher

```ts
export function createDispatcher(
  listeners: readonly AnyListener[],
  options?: { now?: () => Date },
): {
  /** Never throws: errors are logged. */
  dispatchOwnAndOverdue(ids: ObjectId[]): Promise<void>;
  drainUntilEmpty(options?: { budgetMs?: number }): Promise<{ delivered: number; failed: number; dead: number }>;
};
```

- **Claim** (atomic):
  - `findOneAndUpdate({ ...selector, status: "pending", availableAt: { $lte: now } }, { $set: { availableAt: now + leaseMs }, $inc: { attempts: 1 } }, { sort: { availableAt: 1 }, returnDocument: "after" })`.
  - The selector is `{ _id }` for an own id, and empty for "oldest overdue".
  - An own id with no committed row (an aborted attempt) claims nothing and is skipped.
- **Deliver** a claimed row:
  - Run each listener for `row.type` that isn't in `completedListeners`, in table order.
  - On success: `$addToSet: { completedListeners: name }`.
  - On failure: keep the message and continue with the next listener.
- **Finish** the row:
  - No failure → `status: "done"`, `processedAt: now`.
  - A failure with `attempts >= maxAttempts` → `status: "dead"`, `processedAt`, `lastError`, and `console.error`.
  - Otherwise → `availableAt: now + min(backoffBaseMs × 2^(attempts − 1), backoffCapMs)` and `lastError`.
  - `lastError` is the failing listener's name plus its message, e.g. `"achievements.evaluate: User not found"`. When several listeners fail, `lastError` joins them with `"; "`.
- **`dispatchOwnAndOverdue`** claims and delivers each own id, then up to `overduePerRequest` overdue rows.
- **`drainUntilEmpty`** claims and delivers the oldest overdue row until none is left or `budgetMs` (default `cronBudgetMs`) has passed. It counts each outcome. A row that failed is backed off at least a minute, so it can't spin inside one drain.

### `runtime.ts`

```ts
const LISTENERS = [
  defineListener({ name: "achievements.evaluate", event: "activity.logged", handle: ({ userId }) => … evaluateAchievements(userId) }),
  defineListener({ name: "achievements.evaluate", event: "progression.leveled-up", handle: ({ userId }) => … evaluateAchievements(userId) }),
  defineListener({ name: "notification.friend-leveled-up", event: "progression.leveled-up", handle: ({ userId, newLevel }) => notifyFriendsLevelUp(userId, newLevel) }),
];
const dispatcher = createDispatcher(LISTENERS);
export const defineRoute = createDefineRoute({ requireUserId, limit, dispatchEvents: dispatcher.dispatchOwnAndOverdue });
export const drainOutbox = dispatcher.drainUntilEmpty;
```

These are thin adapters over the old services until steps 3.6 and 3.8 move them into their modules (C9).

### Cron route

`GET /api/cron/outbox-sweep`:
- `defineRoute({ name: "cron.outbox-sweep", auth: "cron" }, () => drainOutbox())`.
- `maxDuration = 300`, `dynamic = "force-dynamic"`.
- Returns `{ delivered, failed, dead }`.
- `vercel.json` swaps `/api/cron/achievements-sweep` for this path, on the same `0 3 * * *` schedule.

### Script

`npm run outbox` is `tsx --conditions=react-server --env-file=.env.local src/scripts/outbox.ts`.
- `--dead` prints up to 50 dead rows (newest `processedAt` first): `_id`, `type`, `attempts`, `lastError`, `processedAt`.
- `--requeue <id>` resets one **dead** row to `status: "pending"`, `availableAt: now`, `attempts: 0`, `processedAt: null`, and says whether it found one. That's safe: listeners are idempotent (or, for SSE, Decision 2's accepted gap), and completed listeners are skipped.

## Migrated call sites

| File | Before | After |
|---|---|---|
| `lib/services/workouts/log-workout.ts` | `after(evaluateAchievements)` when not replayed | `emit("activity.logged", { userId, activity: { type: "workout", id: workout.id }, occurredAt: now }, { session })` inside the transaction, after the insert |
| `lib/services/runs/log-run.ts` | same | same, with `type: "run"` |
| `lib/services/users/user-state.service.ts` | `after(notifyFriendsLevelUp)` on level-up | `emit("progression.leveled-up", { userId, previousLevel: user.level, newLevel }, { session })` (Decision 5) |
| `lib/services/users/grant-user-xp.ts` | same | same |

A replay never runs the transaction (`createOnce` checks first), so it emits nothing. That matches today's `!result.replayed` guard, which goes.

## Deleted

- `src/app/api/cron/achievements-sweep/route.ts` and its test (its auth cases move to the outbox-sweep test).
- `src/lib/services/achievements/sweep-locked-achievements.ts` and its test.
- `getRecentlyActiveUsers` in `lib/data/user-db.ts` (its only caller was the sweep).
- The `user-state.service ↔ notify-friends-level-up` entry in `.dependency-cruiser-known-violations.json`, since that cycle disappears.

## Transition

- No data to migrate: the collection and its indexes come from `applySchema()` at build.
- Achievements missed before this deploy lose the old sweep's safety net. Production is mostly test accounts, so this is accepted. Any later activity or level-up re-evaluates them.

## Testing

Integration tests against the in-memory replica set. Each test that touches `outbox` clears it first, since other tests' drains claim overdue rows.

| File | Covers |
|---|---|
| `src/server/platform/events/__tests__/outbox.test.ts` | `emit` in an aborted transaction leaves no row. A committed emit is delivered once, and the row is `done`. A failing listener retries alone while a completed one is skipped. An expired lease is reclaimable, a live one is not. A row at 7 attempts that fails again goes `dead` with `lastError`. Two concurrent drains deliver a row once. Uses a test-only event augmentation |
| `src/server/platform/http/__tests__/define-route.test.ts` | Emitted ids reach `dispatchEvents` after a 2xx. Not on a 4xx. A route that emits nothing never calls it |
| `src/app/api/cron/__tests__/outbox-sweep.test.ts` | 401 without and with a wrong bearer. **Done criterion:** with `after()` mocked as a no-op (dispatch killed after commit), a real `POST /api/workouts` for a user one XP short of a level-up, with an accepted friend, leaves pending rows. The sweep then delivers them: the achievement is unlocked once and `publishToMany` is called once. A second sweep delivers nothing and changes nothing |

Existing workout, run, quest-claim and friends tests keep passing. The global `after()` mock runs the dispatch immediately, so route tests exercise the real listeners.

## Known gaps (logged, not fixed here)

- **Duplicate level-up toast** on a crash between the Redis push and recording the listener (Decision 2). Closed by 3.8.
- **A Redis outage counts as success.** `publishToUser` already swallows its errors, so a failed SSE push isn't retried. That's today's behaviour too, and 3.8 removes it.

## Out of Scope

- `achievement.unlocked`, `friendship.*` and `activity.reverted` events (steps 3.5–3.7).
- Notification documents and the inbox (3.8).
- Alerting on dead rows (overhaul spec Out of Scope).

[[Specs Index]]
