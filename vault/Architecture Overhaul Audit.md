# Architecture Overhaul Audit

An audit of FitLevelUp's current system design, data model and code layout, compared with the `apartment-system` project. Written 2026-10-20 on branch `chore/agent-workflow-setup` (all 99 tests passing, 19 files).

apartment-system is a **comparison point, not a template**. Each project solves some problems better than the other, and some problems neither solves well. Every choice in §5 and §6 is judged on what it does for FitLevelUp, never on which project already does it.

It has three jobs:

1. Describe what FitLevelUp is today, accurately enough to plan against (§1–§3).
2. List the defects and drift found while reading every back-end file (§4).
3. Weigh each approach on its merits — FitLevelUp's, apartment-system's, or one neither uses (§5) — and set out the decided target shape (§6). §7 records the decisions and what is still open for the design spec. §8 orders the work into steps, each with a prompt that starts the workflow pipeline.

Read [[Domain Architecture]] and [[Data Model And API Reference]] for the current system in depth. apartment-system's own guides live in `~/Projects/apartment-system/vault/` (start with `Module Architecture Guide.md` and `System Architecture Guide.md`).

---

## 1. The two systems at a glance

A side-by-side of the facts only; §5 judges them.

| Concern | FitLevelUp (today) | apartment-system |
|---|---|---|
| Repo shape | One Next.js 16 package | npm-workspaces monorepo: `apps/api` + `apps/web` |
| Back end | Next.js Route Handlers in `src/app/api/**` | NestJS 11, feature modules with DI |
| Back-end layering | route → service function → domain function → `*-db.ts` | controller → `@Injectable()` service → repository (pure helpers as plain functions beside them) |
| Module boundaries | By convention only; any file can import any other | Enforced by Nest `imports`/`exports`; no cycles allowed |
| Database | MongoDB (replica set for transactions) | Postgres (Supabase), Drizzle ORM, one `schema.ts`, SQL migrations |
| Schema source of truth | TypeScript types + `ensure-indexes.ts` | `database/schema.ts` → `drizzle-kit generate` → `supabase/migrations/` |
| Auth | better-auth, sessions in Mongo, the game state lives on the auth `user` document | Supabase Auth; app `account` row mirrors the auth UUID; domain profile tables are separate |
| Authorization | `getAuthUserId()` called by hand in each route | Global guard chain: `AuthGuard` → `RoleGuard` → `PropertyScopeGuard` → `OwnershipGuard` |
| Data scoping | `userId` added to each filter by hand | `ScopedRepository<T>` base class makes the scope a required argument |
| Validation | Zod schemas, parsed by hand in each route (one route skips it) | `class-validator` DTOs + global `ValidationPipe({ whitelist, forbidNonWhitelisted })` |
| Errors | `AppError` subclasses + `handleApiError()` in every route's `catch` | Nest `HttpException` subclasses + Nest's default filter; no try/catch in controllers |
| Rate limiting | One Upstash limiter (20/hour) called by hand on some mutations | Global `ThrottlerGuard` (120/min/route/IP) + `@ThrottleExpensive()` opt-in |
| Cross-module side effects | Direct calls + `after()` from `next/server` | Domain events (`EventEmitter2`), one `events.ts` per emitting module, listeners in the reacting module |
| Notifications | Ephemeral: Redis list per user, 60 s TTL, polled every 5 s by an SSE route | Persistent `notification` table (in-app inbox) + email channel, fed by event listeners |
| Background jobs | `after()` + a Vercel Cron HTTP route | `@nestjs/schedule` `@Cron()` inside the API process + a CLI script to run it on demand |
| Audit trail | None | `@LogActivity()` decorator + global interceptor → `activity_log` table |
| Idempotency | `idempotencyKey` in the JSON body; client detects it by string-searching the body | `Idempotency-Key` header, a pipe, and an `Idempotent-Replayed` response header |
| Front-end data | `lib/data/api-client/*` + query keys written inline in pages and components | `lib/<domain>/{types,hooks,utils}`; every query key and invalidation lives in the domain hook |
| Front-end pages | Route groups `(app)`, `(auth)`, `(landing)`; two pages read Mongo directly as Server Components | Route groups per portal; pages never touch the database; every call goes to the API |
| UI kit | Hand-built primitives in `components/ui/` | shadcn/ui on Base UI, added via CLI; feature-shared components in `components/shared/` |
| Tests | Vitest; services against an in-memory Mongo replica set | Jest `*.spec.ts` (unit) + `*.integration.spec.ts` (real Postgres, self-skipping); Vitest on web |
| Hosting | Vercel only (serverless) | Vercel (web) + Render (long-running API, single instance for the cron) + Supabase |

---

## 2. Current system design

### 2.1 Runtime topology

```
Browser ──► Next.js on Vercel
              ├─ proxy.ts            page guard (calls /api/auth/get-session over HTTP)
              ├─ Server Components   dashboard/ and profile/ read Mongo directly
              ├─ Route Handlers      /api/** (auth, Zod, service, JSON)
              │     └─ after()       achievements, level-up fan-out
              ├─ /api/friends/events SSE: loops for 60 s, LPOP from Redis every 5 s
              └─ /api/cron/achievements-sweep  (Vercel Cron)
          MongoDB Atlas (replica set)    Upstash Redis (rate limit + SSE queues)
```

Two facts about this topology shape the overhaul more than any single defect:

- **There are two server entry points to the same logic.** Route Handlers and Server Components (`app/(app)/dashboard/page.tsx`, `app/(app)/profile/page.tsx`) both call services and `*-db.ts` directly. A separate API makes the second path impossible.
- **Serverless drives the workarounds.** The Redis polling SSE, the 60-second `maxDuration`, the `after()` + cron safety net and the per-call Redis clients all exist because there is no long-running process. A NestJS API on a long-running host removes the need for most of them.

### 2.2 Layers as they actually are

The four documented layers hold up well in the write paths (`logWorkout`, `logRun`, `claimQuestReward`). They are bypassed in the read paths:

| Route / page | Layer it skips |
|---|---|
| `GET /api/workouts`, `GET /api/runs` | Route calls `*-db.ts` directly and does the pagination math itself |
| `GET/POST /api/workout-templates`, `DELETE /api/workout-templates/[id]` | Route calls `*-db.ts` directly |
| `DELETE /api/workouts/[id]`, `DELETE /api/runs/[id]` | Route calls `*-db.ts` directly, so no service can reverse the XP or totals |
| `GET /api/profile/records`, `GET /api/runs/stats`, `GET /api/achievements` | Route assembles data from `*-db.ts` and `lib/utils` |
| `dashboard/page.tsx`, `profile/page.tsx` | Server Component calls services and `*-db.ts` |

### 2.3 Module inventory (back end)

| Domain | Services | Domain rules | Data | Routes |
|---|---|---|---|---|
| Users / progression | `UserStateService`, `grantUserXP`, `getDashboardStats` | `user-rules`, `stamina-rules` | `user-db` | `/api/user`, `/api/stats/dashboard` |
| Workouts | `logWorkout`, `updateWorkout` | `workout-rules`, `workout-evaluator`, `muscle-evaluator` | `workout-db` | `/api/workouts`, `/api/workouts/[id]` |
| Runs | `logRun`, `updateRun` | `run-rules`, `run-evaluator` | `runs-db` | `/api/runs`, `/api/runs/[id]`, `/api/runs/stats` |
| Exercises | `createCustomExercise`, `getCustomExercises` | `exercise-rules` | `custom-exercises-db` | `/api/exercises` |
| Templates | `createWorkoutTemplate` | — | `workout-templates-db` | `/api/workout-templates`, `/[id]` |
| Quests | `syncUserQuests`, `getUserQuests`, `updateQuestProgress`, `claimQuestReward` | `quest-rules` | `quests-db` | `/api/quests`, `/api/quests/[id]/claim` |
| Achievements | `evaluateAchievements`, `sweepLockedAchievements` | `achievement-rules` | `achievements-db` | `/api/achievements`, `/api/cron/achievements-sweep` |
| Friends | 7 services incl. `notifyFriendsLevelUp` | `friend-rules` | `friendships-db` | `/api/friends/**` |
| Real time | — | — | `sse-publisher` (Redis), `sse-registry` (deprecated) | `/api/friends/events` |
| Records | — | `lib/utils/records.ts` (domain logic living in `utils/`) | — | `/api/profile/records` |

---

## 3. Data model audit

### 3.1 Collections

| Collection | Owner | Shape notes |
|---|---|---|
| `user` | **better-auth** | Auth identity *and* all game state (`level`, `xp`, `xpToNextLevel`, `streak`, `lastActivityDate`, `stamina`, `lastStaminaUpdate`, `totalWorkouts`, `totalDistance`, `__v`). `_id` is an `ObjectId` |
| `workouts` | app | `userId` as **string**; `exercises[]` embedded (name, `targetMuscle`, sets, reps, weight); `date` as `Date`; `idempotencyKey` |
| `runs` | app | `userId` string; `distance`, `duration`, `pace` (derived), `difficulty`, `xpEarned`, `date` |
| `customExercises` | app | `userId`, `name`, `targetMuscle` |
| `workout_templates` | app | `exercises[]` embedded; `createdAt` stored as an ISO **string** (every other collection uses `Date`) |
| `quest_templates` | seed script | Static game content: `metric`, `target`, `xpReward`, `category`, `isActive` |
| `user_quests` | app | Per-user per-period progress; `periodStart`/`periodEnd` are date strings **or** the sentinel `"all-time"` |
| `achievements` | seed script | Definitions keyed by a string `id` (e.g. `first_workout`) with a `condition` |
| `user_achievements` | app | `userId`, `achievementId`, `unlockedDate` (string) |
| `friendships` | app | `requesterId`, `receiverId`, `status` (`pending`/`accepted`/`declined`), timestamps |
| `session`, `account`, `verification` | better-auth | — |

### 3.2 Data-model findings

1. **Identity and game state share one document owned by the auth library.** Every XP write is a write to better-auth's `user` row, and the domain depends on fields better-auth doesn't know about. apartment-system keeps these apart: `account` mirrors the auth UUID, and domain rows (`tenant_profile`) reference it. FitLevelUp needs the same split, e.g. a `player_profile` keyed by user id.
2. **The id types are mixed.** `user._id` is an `ObjectId`, while every foreign reference (`userId`, `requesterId`, `questTemplateId`) is a string. Joins only work because code converts by hand (`new ObjectId(userId)`), and there is no referential integrity at all. A relational schema with UUID foreign keys fixes both.
3. **Denormalized counters drift.** `totalWorkouts`, `totalDistance`, `xp` and quest `progress` are incremented when an activity is logged, but nothing decrements or recomputes them when a workout or run is **edited or deleted** (see F-4). Achievements and the leaderboard-style friend sort read these drifting numbers.
4. **Derived values are stored.** `xpToNextLevel` is always `level × 500`, and `pace` is always `duration / distance`. Storing them invites drift if `GAME_CONFIG` changes. Compute them, or snapshot them deliberately (apartment's "snapshot" pattern) and say so.
5. **Embedded exercises block queries.** Personal records, the muscle heatmap and "beat your ghost" all need "max weight per exercise" or "volume per muscle", which today means loading every workout into memory (F-9). An exercise-set table (or at least an indexed `exercises.name` path) turns these into one aggregate query.
6. **Two concurrency controls on one row.** User updates use both a Mongo transaction *and* an `__v` optimistic-lock retry loop, implemented twice (`UserStateService.applyActivity` and `grantUserXP`). One mechanism is enough. In Postgres an atomic `UPDATE … SET xp = xp + $1` or a row lock replaces both.
7. **Missing uniqueness guarantees** (detail in F-5): `user_achievements (userId, achievementId)`, `customExercises (userId, name, targetMuscle)`, and friendships per *unordered* pair.
8. **Sentinel strings in date fields.** `"all-time"` in `periodStart`/`periodEnd` only works because `"a" > "2"` in string comparison. Use a nullable period or a separate `category`-driven rule.
9. **Collection names are configurable but inconsistent.** `env.ts` defaults `MONGODB_CUSTOM_EXERCISES_COLLECTION` to `customExercises` while `db-config.ts` falls back to `custom_exercises`, and `usersCollection` is hard-coded to `"user"`. Ten env vars exist for collection names that never vary by environment.
10. **No XP history.** There is no record of *why* a user has their XP. A small `xp_ledger` (source type, source id, amount) would make reversals on delete exact, make achievements and lifetime XP queryable, and give the activity feed something to read.

---

## 4. Findings

Ranked most severe first. "F-n" ids are referenced from §5.

### Correctness

**F-1. Domain validation errors return 500.** Domain rules throw plain `Error`, which `handleApiError` treats as unhandled. Claiming an incomplete quest (`quest-rules.ts:33`), sending a friend request to yourself (`friend-rules.ts:7`) and an empty workout title after trimming (`workout-rules.ts:8`) all reach the user as `500 Internal Server Error` and are logged as crashes. The same is true of `user-db.ts:55` ("User not found") and of the optimistic-lock exhaustion errors.

**F-2. Invalid ids return 500.** `new ObjectId(id)` throws on malformed input in `quests-db.ts:78,114,163,179` and `workout-templates-db.ts:54`, so `POST /api/quests/abc/claim` and `DELETE /api/workout-templates/abc` crash instead of returning 404. Workouts, runs and friendships guard with `ObjectId.isValid`. Quests and templates do not.

**F-3. The quest-sync cooldown never works.** `get-user-quests.ts:7` creates the `syncCooldowns` map *inside* the function, so it is always empty and every `GET /api/quests` (and every dashboard render) runs a full `bulkWrite` upsert.

**F-4. Editing or deleting an activity doesn't reconcile game state.** `updateWorkout`/`updateRun` recompute `xpEarned` on the activity but never adjust the user's XP, level, totals or quest progress; deletes go straight to `*-db.ts` from the route. A user can log a 300-minute workout, collect the XP and level-up, then edit it to 1 minute or delete it and keep everything.

**F-5. Duplicate rows are possible under concurrency.** `evaluateAchievements` can run twice at once (the `after()` fast path and the cron sweep, or two quick activities). With only a non-unique index on `user_achievements.userId` (`ensure-indexes.ts:47`), both inserts succeed and `totalAchievements` counts twice. `createCustomExercise` has the same read-then-insert race with no unique index (`ensure-indexes.ts:74`). `createWorkoutTemplateInDb` checks then inserts, so a racing retry gets a raw duplicate-key 500.

**F-6. Quest progress is lost if quests weren't synced this period.** `updateQuestProgress` only updates `user_quests` rows that already exist. Rows are created by `syncUserQuests`, which runs when the quests page or dashboard is viewed. A user who logs a workout on Monday before opening the app gets no weekly-quest credit for it. The reads in `updateQuestProgress` also don't pass the transaction `session`.

**F-7. Re-sending a declined friend request fails.** The unique index is on `(requesterId, receiverId)`. After A→B is declined, the service allows a new A→B request, but the insert hits the unique index and returns "already sent". If B later requests A, a second document is created for the same pair.

**F-8. Dates are computed in UTC, with local-time mixing.** Streaks, quest periods and "this week" use `toISOString().slice(0, 10)` (UTC). `getMondayDateString` mixes local `getDay()` with UTC formatting. For a user in the Philippines (UTC+8), a 7 AM workout counts toward *yesterday*, which can break a streak. apartment-system solved the same problem with property-level date helpers (`billing/utils/property-date.ts`). FitLevelUp needs a per-user time zone.

### Performance

**F-9. Unbounded reads and an N+1.**
- `getFriends` (`get-friends.ts:12`): for **each** friend, loads their user doc plus **all** their workouts and **all** their runs, to compute personal records on the fly. Grows with friends × lifetime history.
- `getFriendRequests` (`get-friend-requests.ts:9`): one sequential user query per request.
- `GET /api/profile/records` and `GET /api/runs/stats` load the user's entire history to compute a few numbers.
- `dashboard/page.tsx:26` loads every workout to show three and compute seven booleans.

**F-10. SSE polling is expensive and lossy.** Each open tab makes an Upstash REST call every 5 s (≈ 17k calls/day per user who leaves a tab open), receives at most one event per 5 s, and reconnects every 60 s. Events expire after 60 s, so a user who is offline never sees "X accepted your request". There is no inbox.

### Security

**F-11. Rate limiting is partial and too coarse.** One limiter (20 requests/hour, `rate-limit.ts:6`) is shared by every rate-limited mutation, so a heavy training day plus a few friend actions locks a user out. Several mutations aren't limited at all: `POST /api/exercises`, `POST/DELETE /api/workout-templates`, `POST /api/quests/[id]/claim`, `PUT/DELETE /api/workouts/[id]`, `PUT/DELETE /api/runs/[id]`.

**F-12. One route skips validation.** `POST /api/exercises` (`exercises/route.ts:21`) passes `name` and `targetMuscle` from the raw body into the service. A non-string `name` throws inside `formatExerciseName` (500), and any string is accepted as `targetMuscle`. This breaks the repo's own "every route validates with Zod" rule.

**F-13. Wrong status for forbidden actions.** Accepting someone else's request returns `401 Unauthorized` (`accept-friend-request.ts:23`, `decline-…:19`, `remove-friend.ts:12`). It should be `403`, and there is no `ForbiddenError` class.

**F-14. Already tracked in [[Known Issues]]:** `/templates` isn't in `protectedRoutes`, and the cron route is open when `CRON_SECRET` is unset (`CRON_SECRET` is read from `process.env`, not `env.ts`).

### Structure and maintainability

**F-15. Two XP code paths.** `grantUserXP` (quest claims) and `UserStateService.applyActivity` (workouts and runs) each contain their own retry loop and their own level-up side effect. `AGENTS.md` says `UserStateService` owns every user-state transition; quest claims bypass it.

**F-16. Services import each other.** `user-state.service` imports `friends/notify-friends-level-up`, and `logWorkout` imports quests, users and achievements. This is the coupling apartment-system replaces with events: "a level-up happened" should be announced, and the friends and notification modules should react to it.

**F-17. Domain purity is uneven.** `quest-rules.ts` reaches for the clock through `utils/dates`. `calcActiveDays` and `calcMuscleVolume` call `new Date()`. `lib/utils/records.ts` holds domain logic. `lib/types.ts` imports `PersonalRecord` from `lib/utils`.

**F-18. Dead and deprecated code.** `sse-registry.ts` is marked `@deprecated` and kept alive by its own tests. `achievements-db.ts` still has ~45 lines of commented-out seed data. `calcActiveDays` has no service caller (only the page uses it). The `@better-fetch/fetch` call in `proxy.ts` makes an HTTP round trip to its own server on every protected navigation.

**F-19. Front-end cache keys are scattered.** Query keys are string literals in pages and components (`["workouts", page]`, `["runs-stats"]`, `["personal-records"]`, `["workoutTemplates"]`). Logging a workout invalidates `["user"]` (in `useEntityForm`) and the workouts page adds three more, but nothing invalidates dashboard stats or achievements. The custom-exercise query and mutation are copy-pasted in `WorkoutForm` and `CreateTemplateForm`. `WorkoutForm.tsx` is 469 lines.

**F-20. Idempotency detection is string-based.** `apiFetch` decides a POST is retry-safe if the JSON body *contains the text* `idempotencyKey`. An `Idempotency-Key` header, as in apartment-system, is explicit.

### What is solid and should carry over

- The pure evaluators (`evaluateWorkout`, `evaluateRun`) and `GAME_CONFIG` as a typed table.
- `QUEST_ACTIVITY_UPDATES` as a variant table instead of a `switch`.
- Integration tests that always run against a real database engine (the in-memory replica set), never mocked repositories and never skipped.
- One Zod schema per input, shared by the form and the route.
- Idempotent creates with recovery on duplicate key (`logWorkout`, `logRun`).
- Atomic quest sync with `bulkWrite` + `$setOnInsert`, and claim-once via `updateOne({ claimed: false })`.
- `env.ts` validation at startup.

---

## 5. Approach-by-approach evaluation

For each concern, the best option for FitLevelUp, whichever project it comes from. Verdicts:

- **Keep FitLevelUp's**: FitLevelUp's current approach is the better one.
- **Adopt apartment's**: apartment-system's approach is better, on the stated merits.
- **Neither**: both fall short; a third option is better.
- **N/A**: FitLevelUp has no such need.

### 5.1 Where FitLevelUp already has the stronger design

| Concern | FitLevelUp | apartment-system | Why FitLevelUp's wins |
|---|---|---|---|
| Input validation | One Zod schema per input, shared by form and route | `class-validator` DTO on the API **and** a separate Zod schema on the web for the same input (e.g. reject-payment `reason`) | One definition can't drift out of sync. The only gap is enforcement (F-12), which a route wrapper closes (§6.2) |
| Integration tests | In-memory Mongo replica set: every suite always runs, locally and in CI, no Docker | Real Postgres, but suites `describe.skip` themselves when no `DATABASE_URL` is reachable (`test/integration-db.ts:16`), so CI can pass without running them | A test that can silently skip proves nothing |
| Services | Plain exported functions; collaborators passed as arguments | `@Injectable()` classes with constructor DI | DI earns its keep when a container manages lifetimes and test doubles. Here, passing the `session` and the clock as arguments is simpler and just as testable |
| Small helpers | "Extract at the second caller" | `billing/utils/` holds 14 single-function files, each with its own spec | Fewer files to open per flow; apartment's own `AGENTS.md` warns against this shape |
| Domain purity | A dedicated layer that must not do I/O | Pure helpers sit beside services with no rule stopping I/O | Keep the purity rule, but colocate the pure files inside each module (`*.rules.ts`) and enforce "no I/O imports" with a lint rule (§6.2) |
| Deployment | One package, one deploy on Vercel | Two deploys + a single-instance always-on API for the cron | For one product at this size, one deployable is less to run |

### 5.2 Where apartment-system has the stronger design

| Concern | FitLevelUp today | apartment-system | Why apartment's wins → FitLevelUp shape |
|---|---|---|---|
| Module boundaries | Convention only; any file imports any other | Nest `imports`/`exports`; cycles fail at boot | Boundaries that a tool enforces don't erode. → `index.ts` per module + import-rule lint + cycle check in CI (§6.2) |
| Cross-cutting route concerns | Each route calls auth, rate limit, Zod and `handleApiError` by hand; several forget (F-11, F-12) | Global pipe, guards and filter | Opt-out beats opt-in. → `defineRoute()` wrapper (§6.2) |
| Data scoping | `userId` added to each filter by hand | `ScopedRepository<T>` makes the scope a required argument | IDOR becomes a type error. → `UserScopedRepository<T>` |
| Decoupled side effects | Services import each other (F-16) | Domain events, `events.ts` per emitting module, listener-only modules | Notification and achievement logic stop leaking into training. → events, but made durable (§5.3) |
| Notifications | Ephemeral Redis queue, 60 s TTL | Persistent `notification` table | Offline users still see what happened. → `notifications` collection |
| Idempotency | Client sniffs the body for the text `idempotencyKey` | `Idempotency-Key` header + replay header | Explicit and transport-level. → adopt |
| Time | UTC everywhere; local/UTC mixing (F-8) | Property time zone helpers | Day boundaries must be the user's. → per-user `timeZone` |
| Transitions | `if` checks spread across friend services | `PAYMENT_TRANSITIONS` table + `assertPaymentTransition()` | One place lists the legal moves. → friendship transition table |
| Front-end data | Query keys as string literals in pages | `lib/<domain>/hooks` own keys and invalidation | Fixes F-19. → adopt |
| Schema source of truth | Types in `lib/types.ts`, indexes in `ensure-indexes.ts`, no validators | One `schema.ts` | One place to read the data model. → `schema.ts` with types, indexes and `$jsonSchema` validators |

### 5.3 Where neither is best

| Concern | FitLevelUp today | apartment-system | Better option |
|---|---|---|---|
| **Delivering side effects reliably** | `after()` fire-and-forget, plus a cron that re-evaluates only achievements | In-memory `EventEmitter2`: an event is lost if the process dies between commit and listener | **Transactional outbox.** Write an `outbox` document in the *same* transaction as the workout. `after()` processes it immediately; a cron sweep re-runs anything unprocessed. Listeners are idempotent (unique keys). Durable on serverless, and one generic sweep replaces the achievements-specific one |
| **XP and totals after edits and deletes** | Counters incremented once, never reconciled (F-4) | Snapshot + compensating writes per case | **Ledger as source of truth.** Every XP grant is an `xp_ledger` row keyed by its source. Editing or deleting an activity replaces or removes its row, and the profile (XP, level, totals) is recomputed from the ledger. Exact by construction, and a `GAME_CONFIG` change can be replayed. The cost: a recompute per edit, which is cheap at one user's scale |
| **Static game content** (quests, achievements) | Seeded into Mongo by scripts; read from the DB on every evaluation | Configuration in tables | **Typed constants in code** (`as const`), versioned and reviewed in git; only per-user progress lives in the database. Removes seed drift, the `ObjectId` template ids and a DB read per evaluation. `AGENTS.md` "Domain Data Extraction" already points this way |
| **Rate limiting** | One 20/hour bucket for everything | 120/min per route per IP | **Per user *and* route, with tiers** (`standard`, `expensive`) on Upstash. Per-IP is wrong for a logged-in app behind mobile carrier NAT |
| **Concurrency on the user row** | Transaction **and** a `__v` retry loop, written twice (F-15) | CAS updates in SQL | **Atomic `$inc`/`$set` inside the transaction.** Mongo's transaction write-conflict retry already covers the race; drop `__v` |
| **Server-rendered pages** | Server Components call `*-db.ts` directly | Web never touches the DB; all reads go over HTTP to the API | **Server Components call a module's public `index.ts`.** Keeps the fast first render without an HTTP hop, while the boundary rules still apply |

### 5.4 Not applicable

Roles and multiple portals, property scoping, the admin audit log (`@LogActivity`), Supabase Data API lockdown, shadcn/ui (decided against in §7), the npm-workspaces monorepo (decided against in §7).

---

## 6. Target shape

Decided 2026-10-20 (see §7): stay **one Next.js package on Vercel**, keep **MongoDB**, **better-auth** and the **Modern Athletic** UI. The shape below combines the winners from §5: FitLevelUp's strengths kept, apartment-system's better patterns adopted, and the §5.3 options where neither was best.

The main risk of one package is that boundaries hold only by convention, and §2.2 shows that convention already slips. So every boundary below is enforced by a tool: a route wrapper, the `server-only` package, ESLint import rules and a dependency-cycle check in CI.

### 6.1 Folder layout

```
src/
  app/                              pages and route.ts files only
    (landing)/  (auth)/
    (app)/<page>/{page.tsx, loading.tsx, error.tsx, _components/}
    api/**/route.ts                 one line per handler: defineRoute({...}, module call)
  server/                           everything that runs only on the server ("server-only")
    platform/                       the NestJS-equivalent infrastructure
      database/                     client, schema.ts, UserScopedRepository<T>, mongo-error utils
      http/                         defineRoute(): auth, throttle, Zod parse, idempotency, error mapping
      events/                       typed in-process event bus; listeners run in after()
      auth/                         better-auth instance, getSession helper
      config/                       env.ts, game-config.ts
    progression/                    XP, level, streak, stamina (today's UserStateService)
    training/                       one module, one folder per use case
      workouts/  runs/  templates/  exercises/  records/
    quests/
    achievements/
    social/
    notification/
  components/
    ui/                             Modern Athletic primitives (unchanged)
    shared/                         cross-page components (PageHeader, StatCard, NotificationBell…)
  lib/<domain>/{types,hooks,utils}/ browser side only: query keys, hooks, client helpers
  lib/shared/utils/api.ts           getJson/postJson/patchJson/deleteJson + Idempotency-Key + retry
```

`src/server/` replaces today's `lib/services`, `lib/domain`, `lib/data`, `lib/sse`, `lib/api` and `lib/auth`. `src/lib/` becomes browser-side only. The server/browser line is enforced by `server-only`, not by a second package.

### 6.2 Anatomy of a server module

Each module is a folder with one public entry point:

```
server/training/
  index.ts                 the module's public API: the only file other modules may import
  events.ts                one interface per event this module emits
  types.ts                 types shared across the module's folders
  workouts/
    log-workout.ts         use case: load → rules → persist in one transaction → emit
    update-workout.ts
    delete-workout.ts      reverses XP and totals through progression (fixes F-4)
    workout.repository.ts  extends UserScopedRepository<WorkoutDoc>
    workout.rules.ts       pure: evaluateWorkout, calcWorkoutXP (no clock, no I/O)
    workout.schemas.ts     Zod input schemas + inferred types
    *.test.ts              integration tests against the in-memory replica set
  runs/  templates/  exercises/  records/
```

| Concern | How it is enforced |
|---|---|
| Module public API | `index.ts`; ESLint `no-restricted-imports` blocks deep imports into another module |
| Use cases | Plain exported functions; collaborators (the Mongo `session`, the clock) passed as arguments |
| Pure rules | `*.rules.ts` may not import `platform/`, repositories or `next/*` (lint rule), and take the current time as an argument (fixes F-17) |
| Routes | `route.ts` calls `defineRoute()` with one module function |
| Validation | `defineRoute({ body: Schema, query: Schema })` parses with the same Zod schema the form uses |
| Auth | `defineRoute({ auth: "user" })` passes `userId` to the handler; `auth: "cron"` checks a required `CRON_SECRET` |
| Rate limits | `defineRoute({ throttle: "standard" \| "expensive" })`, required on every mutation; a route-table test fails if one is missing |
| Errors | `defineRoute` maps `AppError`, `ZodError`, `DomainError` and invalid ids; no try/catch in routes (fixes F-1, F-2, F-13) |
| Data scoping | `UserScopedRepository<T>`: every method takes `userId`, and `findById` validates the id first |
| Side effects | `server/platform/events`: `emit()` writes an `outbox` document in the caller's transaction; `after()` dispatches it, a cron sweep retries stragglers (§5.3) |
| Scheduled work | Vercel Cron routes calling a module function (`auth: "cron"`) |
| Dependency graph | `dependency-cruiser` (or `eslint-plugin-boundaries`) in CI: no cycles, `server/` never imported by client code, `notification/` and `achievements/` imported by no module |

The `defineRoute` wrapper reverses Candidate B in [[Architecture Review]], which kept a `handleApiError()` call in every route for traceability. The evidence since then is F-11 and F-12: routes that skipped validation or rate limiting because each route had to remember them. The trade-off is one extra hop in a stack trace.

### 6.3 Module dependencies

| From | To | How | Why |
|---|---|---|---|
| `training` | `progression` | direct call, same transaction | XP, streak and stamina must commit with the workout |
| `training` | `quests` | direct call, same transaction | Decided in §7: progress commits with the activity |
| `quests` | `progression` | direct call, same transaction | Claim XP must commit with the claim (fixes F-15: one XP path) |
| `training` | `achievements` | event `activity.logged` / `activity.reverted` | Must not block or fail the request |
| `progression` | `notification`, `achievements` | event `progression.leveled-up` | Friends are told; level achievements are checked |
| `achievements` | `notification` | event `achievement.unlocked` | Toast and inbox entry |
| `social` | `notification` | event `friendship.requested` / `friendship.accepted` | Request and accept notices |

`progression` calls no other feature module. `notification` and `achievements` are reached only through events, so either could be removed without breaking the build. Every event goes through the outbox, so a function killed after commit delays a side effect but never loses it.

### 6.4 Data model changes (staying on MongoDB)

`server/platform/database/schema.ts` becomes the single source of truth for the data model: every document type, every index (today's `ensure-indexes.ts`) and a `$jsonSchema` validator per collection, applied by the existing `migrate-db.ts` at build.

| Change | Fixes |
|---|---|
| New `player_profiles` collection keyed by the better-auth user id; game state leaves better-auth's `user` document | §3.2 #1 |
| Store `userId` as the same type everywhere (string), and route every by-id lookup through `UserScopedRepository` | §3.2 #2, F-2 |
| Unique indexes: `user_achievements (userId, achievementId)`, `custom_exercises (userId, nameLower, targetMuscle)`, `friendships (pairKey)` where `pairKey` is the sorted pair | F-5, F-7 |
| `xp_ledger` collection (`userId`, `sourceType`, `sourceId`, `amount`), unique `(sourceType, sourceId)`; profile XP, level and totals recomputed from it on edit/delete (§5.3) | F-4, F-15, §3.2 #10 |
| `outbox` collection (`type`, `payload`, `createdAt`, `processedAt`), index on unprocessed | F-16, durable side effects (§5.3) |
| Quest and achievement definitions move to typed constants in code; `quest_templates` and `achievements` collections retire | Seed drift, F-2 on template ids (§5.3) |
| Drop `__v`; user-row updates are atomic `$inc`/`$set` inside the transaction | §3.2 #6 |
| Compute `xpToNextLevel` and `pace` instead of storing them | §3.2 #4 |
| `user_quests.periodStart` null for all-time, no `"all-time"` sentinel | §3.2 #8 |
| `timeZone` on the player profile; streaks and quest periods computed in it | F-8 |
| A `notifications` collection (inbox) written by the notification listeners; SSE or polling reads from it, so offline users don't lose events | F-10 |
| Drop the ten collection-name env vars; names live in `schema.ts` | §3.2 #9 |
| Embedded `exercises[]` stays, with a multikey index on `exercises.nameLower` for personal records | §3.2 #5 |

### 6.5 Front end

`lib/<domain>/hooks/` owns every query key and every cross-domain invalidation (one `queryKeys` table per domain, fixing F-19). Page-scoped components move into `app/(app)/<page>/_components/`. Server Components keep rendering data on the server, but only through a module's `index.ts`, never a repository (§5.3). The Modern Athletic primitives in `components/ui/` stay as they are.

---

## 7. Decisions

### 7.1 Decided (2026-10-20)

| # | Question | Decision |
|---|---|---|
| 1 | API framework | **One Next.js package**; no NestJS. Boundaries enforced by tooling (§6.2) |
| 2 | Database | **Stay on MongoDB.** Fix the model in place (§6.4) |
| 3 | Auth | **Keep better-auth** |
| 4 | Hosting | **Serverless only** (Vercel). Vercel Cron and `after()` remain |
| 5 | Quest progress | **In the transaction**, as today |
| 6 | UI kit | **Keep Modern Athletic** primitives |
| 7 | Sequencing | **Strangler migration**: build `server/platform/` first, then move one module at a time behind the existing UI |
| 8 | Existing defects | **Fix forward**: fix F-1 to F-8 on the current code before the migration starts |

### 7.2 Still open (for the design spec)

1. **Real-time delivery on serverless.** Keep SSE but read from the `notifications` inbox instead of the Redis queue, or replace SSE with React Query polling of `GET /api/notifications?since=`? Polling removes Upstash from the notification path entirely.
2. **Rate-limit backend.** Upstash stays (serverless has no shared memory), but with per-tier limits (`standard`, `expensive`) keyed by user and route instead of one 20/hour bucket.
3. **Boundary tool.** `dependency-cruiser` (cycle and layer rules in one config) or `eslint-plugin-boundaries` (feedback in the editor)?
4. **Module order.** Proposed in §8: `platform` → `progression` → `quests` → `training` → `achievements` → `social` → `notification`, each a separate PR. Confirm it in the spec.
5. **Data migration.** Backfill script for `player_profiles` and `xp_ledger` from existing `user` documents and activities.
6. **The three §5.3 proposals.** Each is a recommendation, not yet a decision:
   - the transactional outbox, versus keeping `after()` with per-feature sweeps;
   - the XP ledger as the source of truth, versus stored counters reconciled by hand on edit and delete;
   - game content in code, versus seeded collections.

   The outbox and the ledger are the larger changes; game content in code is small and independent.

---

## 8. Implementation order

### 8.1 Why this order

1. **Fixes first (Phase 0).** They are small, users hit them today, and each one adds regression tests. Those tests then protect behaviour while the code moves.
2. **Spec before platform (Phase 1).** The §7.2 questions decide what `platform/` contains: an outbox or plain `after()`, SSE or polling. Building first would mean building twice.
3. **Platform before modules (Phase 2).** Every module move targets `defineRoute`, `UserScopedRepository`, `schema.ts` and the event bus. They must exist before the first module moves.
4. **Modules in dependency order (Phase 3).** A module moves only after the modules it calls: `progression` (calls nothing) → `quests` (calls progression) → `training` (calls both) → `achievements` (listens to training and progression) → `social` → `notification` (listens to everyone, so it goes last). Until a module moves, the new code calls the old one; that is the strangler.
5. **Front end after its contracts settle (Phase 4).** Hooks and query keys are written once, against final routes.
6. **Cleanup last (Phase 5).** Old folders are deleted only when nothing imports them, then the docs catch up.

**One deliberate exception to decision §7.1 #8:** F-4 (edit or delete keeps XP) is **not** fixed in Phase 0. A correct fix needs XP reversal, including levelling down, which is exactly what the XP ledger provides in step 3.5. Fixing it on the current code would mean building the reversal twice. The exploit is to game progress, not a security or data-loss risk. If it must close sooner, the stop-gap is to block editing `duration` and the exercise list on logged activities.

### 8.2 Steps at a glance

| Step | Pipeline | Delivers | Fixes | Depends on |
|---|---|---|---|---|
| **0.1** | `/fix` | Domain and authorization errors map to 4xx | F-1, F-13 | — |
| **0.2** | `/fix` | Malformed ids return 404 | F-2 | — |
| **0.3** | `/fix` | Security quick fixes | F-12, F-14 | — |
| **0.4** | `/fix` | Unique keys for achievements, custom exercises, templates | F-5 | — |
| **0.5** | `/fix` | Quest sync cooldown and guaranteed sync before progress | F-3, F-6 | — |
| **0.6** | `/fix` | Friend re-request after decline | F-7 | — |
| **0.7** | `/feature` | Per-user time zone for streaks and quest periods | F-8 | 0.5 |
| **1.1** | `/feature` | Architecture Overhaul Design Spec (spec only) | §7.2 | Phase 0 |
| **2.1** | `/refactor` | `server/platform/` skeleton, `schema.ts`, boundary tooling | §3.2 #9 | 1.1 |
| **2.2** | `/refactor` | `defineRoute()` + `UserScopedRepository<T>`, every route migrated | F-12 by construction | 2.1 |
| **2.3** | `/feature` | Per-user, per-route rate-limit tiers | F-11 | 2.2 |
| **2.4** | `/feature` | `Idempotency-Key` header replaces body sniffing | F-20 | 2.2 |
| **2.5** | `/feature` | Transactional outbox + typed event bus | F-16 (infra) | 2.2, 1.1 |
| **3.1** | `/refactor` | `progression` module, `player_profiles` split, one XP path, no `__v` | F-15, §3.2 #1 #4 #6 | 2.5 |
| **3.2** | `/refactor` | Quest and achievement definitions as typed constants | §5.3 | 2.1 |
| **3.3** | `/refactor` | `quests` module | F-17 (quests) | 3.1, 3.2 |
| **3.4** | `/refactor` | `training` module (workouts, runs, templates, exercises, records) | F-9 (records, stats, dashboard), F-17 | 3.1, 3.3 |
| **3.5** | `/feature` | XP ledger; edit and delete reconcile XP, level, totals, quests | **F-4**, §3.2 #3 #10 | 3.4 |
| **3.6** | `/refactor` | `achievements` module as an outbox listener | F-5 (finish), F-16 | 3.4, 2.5 |
| **3.7** | `/refactor` | `social` module, transition table, no N+1 | F-9 (friends), F-16 | 2.5 |
| **3.8** | `/feature` | `notification` module: inbox + real-time delivery | F-10, F-18 (SSE) | 3.6, 3.7 |
| **4.1** | `/refactor` | `lib/<domain>/hooks` own query keys and invalidation (one PR per domain) | F-19 | Phase 3 |
| **4.2** | `/refactor` | Page `_components/`, `WorkoutForm` split, shared custom-exercise hook | F-19 | 4.1 |
| **5.1** | `/refactor` | Delete old `lib/` back-end folders and dead code; sync `AGENTS.md` and vault guides | F-18 | 4.2 |

Steps 0.1–0.6 are independent and can run in any order. 3.2 can run any time after 2.1. 3.7 can run in parallel with 3.3–3.6.

### 8.3 Kickoff prompts

Paste a prompt as-is to start its step. Each one names the audit section to read first, because the workflow's brain scan searches only `vault/history`, `vault/specs` and `vault/plans`.

#### Phase 0 — Fix forward on the current code

**0.1 Domain and authorization errors**
```
/fix Domain validation errors return 500, and forbidden friend actions return 401

Read vault/Architecture Overhaul Audit.md §4 F-1 and F-13 first.
Problem: domain rules (quest-rules.ts, friend-rules.ts, workout-rules.ts, run-rules.ts) and user-db.ts throw plain Error, which handleApiError turns into a logged 500. Accepting, declining or removing another user's friendship throws UnauthorizedError (401) instead of 403.
Expected: a DomainError (or the right AppError subclass) for every rule violation, mapped to 400/404/409; a new ForbiddenError (403) for the friend services; "User not found" becomes 404. Domain files stay pure (no imports from lib/api if that breaks the layer rule: map at the service boundary instead).
Done when: route/service tests prove claiming an incomplete quest → 400, self friend request → 400, accepting someone else's request → 403, and no rule violation is logged as "[Unhandled API Error]".
```

**0.2 Malformed ids**
```
/fix Malformed ids crash with 500 instead of returning 404

Read vault/Architecture Overhaul Audit.md §4 F-2 first.
Problem: new ObjectId(id) throws on malformed input in quests-db.ts (getQuestTemplateByIdFromDb, getUserQuestByIdFromDb, updateUserQuestProgressInDb, markUserQuestClaimedInDb) and workout-templates-db.ts (deleteWorkoutTemplateFromDb). POST /api/quests/abc/claim and DELETE /api/workout-templates/abc return 500.
Expected: the same ObjectId.isValid guard the workout and run modules use, so these routes return 404. Extract the guard once rather than copying it (it has more than two callers).
Done when: route tests for both endpoints with id "abc" return 404.
```

**0.3 Security quick fixes**
```
/fix Three security gaps: unvalidated exercise route, unprotected /templates, open cron route

Read vault/Architecture Overhaul Audit.md §4 F-12 and F-14 and vault/checklist/Known Issues.md first.
Problems:
1. POST /api/exercises passes the raw body into createCustomExercise with no Zod schema and no rate limit.
2. /templates is missing from protectedRoutes in src/proxy.ts.
3. /api/cron/achievements-sweep is open when CRON_SECRET is unset; CRON_SECRET is not in src/env.ts.
Expected: a CreateCustomExerciseSchema in schemas.ts (name trimmed, 1–100 chars; targetMuscle as the TargetMuscle enum) and the existing RateLimit on the route; /templates added to protectedRoutes; CRON_SECRET required in env.ts and every request without the matching bearer token rejected with 401.
Done when: route tests cover an invalid exercise body (400) and the cron route without a token (401); Known Issues.md has both sections removed.
```

**0.4 Duplicate rows under concurrency**
```
/fix Concurrent requests can create duplicate achievements, custom exercises and templates

Read vault/Architecture Overhaul Audit.md §4 F-5 first.
Problem: user_achievements has no unique (userId, achievementId) index, so the after() evaluation and the cron sweep can both insert the same unlock and inflate totalAchievements. custom exercises are checked-then-inserted with no unique index. createWorkoutTemplateInDb checks-then-inserts, so a racing retry gets a raw duplicate-key 500.
Expected: unique indexes in ensure-indexes.ts on user_achievements (userId, achievementId) and on custom exercises (userId, a normalized lowercase name, targetMuscle); inserts that tolerate duplicate keys (ordered:false insertMany, or upsert); template create recovers from 11000 by returning the existing template, like logWorkout does.
Migration: existing duplicates must be removed before the unique index can build. Write an idempotent cleanup in src/scripts/ that runs before ensureIndexes in migrate-db.ts.
Done when: integration tests run two evaluations concurrently and get one unlock, and two concurrent identical creates yield one row and no 500.
```

**0.5 Quest sync**
```
/fix Quest progress is lost when quests weren't synced this period, and the sync cooldown never works

Read vault/Architecture Overhaul Audit.md §4 F-3 and F-6 first.
Problem: get-user-quests.ts creates syncCooldowns inside the function, so every GET /api/quests runs a full bulkWrite. updateQuestProgress only updates user_quests rows that already exist; rows are created only when the quests page or dashboard is viewed, so a workout logged before then earns no quest progress. Its reads also ignore the transaction session.
Expected: updateQuestProgress upserts the current period's rows for the affected metrics inside the caller's transaction before applying progress (bulkWrite + $setOnInsert, then $inc capped at target), and every read and write passes the session. Remove the broken cooldown (sync is idempotent and cheap once progress no longer depends on it) unless a measured need remains.
Done when: an integration test logs a workout for a user with no user_quests rows and sees daily and weekly workout_count progress = 1.
```

**0.6 Friend re-request**
```
/fix A declined friend request can never be re-sent, and reverse requests create a second friendship document

Read vault/Architecture Overhaul Audit.md §4 F-7 first.
Problem: the unique index is on (requesterId, receiverId). After A→B is declined, sendFriendRequest allows a new A→B request but the insert hits the index and returns "already sent". B→A creates a second document for the same pair.
Expected: one document per unordered pair, keyed by a pairKey field (the two ids sorted and joined) with a unique index. Re-requesting after a decline resets that document to pending with the new requester and receiver, atomically (findOneAndUpdate with upsert). Backfill pairKey on existing documents, merging duplicates (keep the accepted one, else the newest).
Done when: integration tests cover decline → re-request (pending again), B→A after A→B declined (same document), and concurrent A→B + B→A (one document).
```

**0.7 Per-user time zone**
```
/feature Streaks, quest periods and "this week" use the user's own time zone

Read vault/Architecture Overhaul Audit.md §4 F-8 first. Prior art for date helpers: apartment-system apps/api/src/billing/utils/property-date.ts (a comparison point, not a template).
Problem: dates are computed as UTC calendar days with toISOString().slice(0, 10), and getMondayDateString mixes local getDay() with UTC formatting. For a UTC+8 user, a 7 AM workout counts toward yesterday and can break a streak.
Want: a validated IANA timeZone stored per user (captured from the browser via Intl at signup and on login if missing; default UTC). Every calendar-day calculation (calcNewStreak, calcDisplayStreak, quest periods, dashboard week boundaries, active days) takes the time zone and "now" as arguments, so domain rules stop reading the clock.
Constraints: the user document is owned by better-auth; use its additionalFields or the profile split planned in step 3.1. Decide which in the brainstorm.
```

#### Phase 1 — Design

**1.1 Architecture Overhaul Design Spec**
```
/feature Architecture Overhaul Design Spec — spec only, no implementation

Read vault/Architecture Overhaul Audit.md in full first; §5–§8 are the input. apartment-system is a comparison point, not a template: justify every choice on its merits.
Goal: write vault/specs/Architecture Overhaul Design Spec.md that settles every §7.2 open question (real-time delivery on serverless, rate-limit backend, boundary tool, module order, data migration, and the three §5.3 proposals: transactional outbox, XP ledger as source of truth, game content in code) and fixes the contracts later steps build on: the defineRoute() options, the UserScopedRepository<T> interface, the event and outbox document shapes, and the schema.ts layout.
Stop after Step 3 (spec) and the readiness check. Steps 2.1 onward in §8 implement it; update §8 of the audit if the spec changes the order.
```

#### Phase 2 — Platform

**2.1 Platform skeleton and boundary tooling**
```
/refactor Create src/server/platform with schema.ts and enforce module boundaries with tooling

Read vault/Architecture Overhaul Audit.md §6.1, §6.2 and vault/specs/Architecture Overhaul Design Spec.md first.
Scope: create src/server/platform/{database,config,auth}; move the Mongo client, get-collection, ensure-indexes (as schema.ts: document types + indexes + $jsonSchema validators), env.ts and game-config.ts into it; drop the ten collection-name env vars. Add server-only to everything under src/server, the import-boundary lint rules and the dependency-cycle check in CI, as chosen in the spec.
Preserved behaviour: no route, page or response changes. Existing lib/ code imports the moved files from their new location.
Done when: npm run lint, typecheck and test:run pass, and CI fails on a deliberate deep import across modules (proved once, then reverted).
```

**2.2 defineRoute and UserScopedRepository**
```
/refactor Replace per-route try/catch and hand-written auth with defineRoute(), and add UserScopedRepository<T>

Read vault/Architecture Overhaul Audit.md §6.2 and the defineRoute and UserScopedRepository contracts in vault/specs/Architecture Overhaul Design Spec.md first.
Scope: implement defineRoute({ auth, body, query, throttle }) in src/server/platform/http (auth, Zod parse, error mapping including DomainError, ForbiddenError and invalid ids) and UserScopedRepository<T> in platform/database. Migrate every src/app/api/**/route.ts to defineRoute; keep throttle on exactly the routes rate-limited today (tiers come in 2.3). Add a route-table test that fails when a mutation lacks validation or a throttle setting.
Preserved behaviour: every status code and response body stays the same, except routes that today return 500 for bad input.
Done when: no route.ts contains try/catch or calls getAuthUserId directly, and the existing route tests pass unchanged.
```

**2.3 Rate-limit tiers**
```
/feature Per-user, per-route rate-limit tiers on every mutation

Read vault/Architecture Overhaul Audit.md §4 F-11 and §5.3, and the rate-limit decision in vault/specs/Architecture Overhaul Design Spec.md first.
Problem: one 20-per-hour Upstash bucket is shared by every limited mutation, and several mutations (exercises, templates, quest claim, workout and run PUT/DELETE) aren't limited.
Want: "standard" and "expensive" tiers keyed by userId + route, values in game-config or a platform constant, applied through defineRoute({ throttle }). A 429 carries Retry-After. The route-table test from 2.2 requires a tier on every mutation.
```

**2.4 Idempotency-Key header**
```
/feature Move idempotency keys from the JSON body to an Idempotency-Key header

Read vault/Architecture Overhaul Audit.md §4 F-20 first.
Problem: apiFetch decides a request is retry-safe by searching the body text for "idempotencyKey".
Want: defineRoute reads an Idempotency-Key header on create routes (workouts, runs, templates) and replays the stored result with an Idempotent-Replayed: true header; apiFetch sends the header and retries only requests that carry it. Forms keep generating the key once per mount. During the transition the server also accepts the body field, then that fallback is removed in the same PR.
```

**2.5 Transactional outbox and event bus**
```
/feature Transactional outbox and typed event bus for side effects

Read vault/Architecture Overhaul Audit.md §5.3 (side effects row) and §6.3, and the outbox decision in vault/specs/Architecture Overhaul Design Spec.md first.
Want: src/server/platform/events with a typed emit(event, session) that writes an outbox document in the caller's transaction, an after() dispatcher that runs the registered listeners right after commit, and a Vercel Cron sweep that retries unprocessed or failed entries with backoff. Listeners must be idempotent; the outbox records attempts and last error.
Migrate the two existing after() side effects (level-up fan-out, achievement evaluation) onto it, so the achievements-specific sweep becomes the generic one.
Done when: an integration test kills dispatch after commit and shows the sweep delivers the event exactly once.
```

#### Phase 3 — Modules, in dependency order

**3.1 progression**
```
/refactor Move user game state into a progression module and a player_profiles collection

Read vault/Architecture Overhaul Audit.md §3.2 (#1, #4, #6), §4 F-15 and §6.2–§6.4 first.
Scope: src/server/progression/ owns XP, level, streak, stamina and totals. Game state moves off better-auth's user document into player_profiles (keyed by the user id), with an idempotent backfill script. grantUserXP and UserStateService.applyActivity merge into one path; the __v retry loops go, replaced by atomic $inc/$set inside the caller's transaction; xpToNextLevel is computed, not stored. Level-up emits progression.leveled-up through the outbox.
Preserved behaviour: every XP, level, streak and stamina outcome in the existing tests; the /api/user response shape.
Done when: no code outside progression/ reads or writes game fields, and the user document holds only auth fields after the backfill.
```

**3.2 Game content in code**
```
/refactor Quest and achievement definitions become typed constants instead of seeded collections

Read vault/Architecture Overhaul Audit.md §5.3 (static game content row) first.
Scope: move the definitions in src/scripts/seed-quests.ts and seed-achievements.ts into as const tables (stable string ids, e.g. "daily_workout_1"). Migrate user_quests.questTemplateId from ObjectId strings to the new ids (idempotent script), retire the quest_templates and achievements collections and the seed scripts, and drop npm run seed.
Preserved behaviour: the same quests and achievements, progress and unlocks, and API response shapes.
```

**3.3 quests**
```
/refactor Move quests into src/server/quests

Read vault/Architecture Overhaul Audit.md §6.2–§6.3 first.
Scope: sync, progress, list and claim move into the module structure (use cases, repository extending UserScopedRepository, pure quest.rules.ts taking "now" and the time zone as arguments). Claim XP goes through progression's public API inside the same transaction. The "all-time" sentinel becomes a null periodStart (with migration). Training keeps calling quest progress through quests/index.ts.
Preserved behaviour: quest outcomes and responses.
```

**3.4 training**
```
/refactor Move workouts, runs, templates, custom exercises and records into src/server/training

Read vault/Architecture Overhaul Audit.md §6.2 (module anatomy), §4 F-9 and F-17 first.
Scope: one folder per use case (workouts/, runs/, templates/, exercises/, records/); log, update and delete go through the module, so deletes stop bypassing services. Personal records, run stats and the dashboard stop loading full history: use aggregations and a multikey index on exercises.nameLower. muscle-evaluator and records logic become pure *.rules.ts taking "now" as an argument. dashboard and profile pages call module index.ts functions, never *-db.ts.
Preserved behaviour: responses and XP outcomes (edit and delete reconciliation is step 3.5).
```

**3.5 XP ledger and edit/delete reconciliation**
```
/feature Editing or deleting a workout or run correctly reverses its XP, level, totals and quest progress

Read vault/Architecture Overhaul Audit.md §4 F-4, §3.2 #3 and #10, §5.3 (XP ledger row) and the ledger decision in vault/specs/Architecture Overhaul Design Spec.md first.
Problem: today a user can log a 300-minute workout, collect the XP and level-up, then edit it to 1 minute or delete it and keep everything.
Want: an xp_ledger (userId, sourceType, sourceId, amount; unique on source) written for every grant (activities and quest claims). Edit replaces the source's entry, delete removes it, and progression recomputes XP, level and totals from the ledger, including levelling down. Quest progress for the affected period is recomputed too. Backfill the ledger from existing activities and claimed quests.
Edge cases to settle in the brainstorm: achievements already unlocked (keep them?), quest rewards already claimed for progress that no longer holds, and a level-down notification (probably none).
```

**3.6 achievements**
```
/refactor Move achievements into src/server/achievements as an outbox listener

Read vault/Architecture Overhaul Audit.md §6.3 first.
Scope: evaluation runs from progression.leveled-up and activity.* events delivered by the outbox (step 2.5); nothing imports the module except through events. Unlocks use the unique (userId, achievementId) key from step 0.4 and emit achievement.unlocked. The old cron sweep is gone, since the outbox sweep covers it.
Preserved behaviour: the same unlocks and GET /api/achievements response.
```

**3.7 social**
```
/refactor Move friendships into src/server/social with a transition table and no N+1 queries

Read vault/Architecture Overhaul Audit.md §4 F-9 and F-16 and §5.2 (transitions row) first.
Scope: one FRIENDSHIP_TRANSITIONS table with an assert function replaces the scattered status checks. getFriends and getFriendRequests load profiles in one query ($in) and read personal records from training's public API (indexed, from 3.4) instead of every friend's full history. Friend events (friendship.requested, friendship.accepted) are emitted through the outbox, not by calling the SSE publisher.
Preserved behaviour: friend API responses and sort order.
```

**3.8 notification**
```
/feature Persistent notification inbox with real-time delivery

Read vault/Architecture Overhaul Audit.md §4 F-10 and F-18 and the real-time decision in vault/specs/Architecture Overhaul Design Spec.md first.
Problem: notifications live in a Redis list with a 60-second TTL, polled every 5 seconds per open tab, so offline users lose them and each tab makes ~17k Upstash calls a day.
Want: src/server/notification as listener-only (imported by no module), writing a notifications collection for friend requests and accepts, friend level-ups and achievement unlocks. Delivery and read state as the spec decided (SSE reading the inbox, or polling GET /api/notifications?since=), PATCH to mark read, and an unread bell in the UI using the Modern Athletic primitives. Retire the Redis SSE queue and the deprecated sse-registry with its tests.
```

#### Phase 4 — Front end

**4.1 Domain hooks and query keys**
```
/refactor Front-end data access moves into lib/<domain>/{types,hooks,utils} with one query-key table per domain

Read vault/Architecture Overhaul Audit.md §4 F-19 and §6.5 first.
Scope: one PR per domain (progression, workouts, runs, templates, exercises, quests, achievements, friends, notifications). Every useQuery and useMutation moves into a domain hook; query keys come from that domain's keys table; each mutation invalidates every key its server change affects (logging a workout also touches progression, quests, achievements and dashboard stats). Pages and components stop importing @tanstack/react-query directly.
Preserved behaviour: screens look and act the same, except stale data now refreshes.
```

**4.2 Page components**
```
/refactor Page-scoped components move to app/(app)/<page>/_components and WorkoutForm is split

Read vault/Architecture Overhaul Audit.md §4 F-19 and §6.5 first.
Scope: components used by one page move next to it; cross-page ones go to components/shared/; components/ui/ (Modern Athletic) is untouched. WorkoutForm (469 lines) is split along its real responsibilities, and the custom-exercise query and mutation copied between WorkoutForm and CreateTemplateForm become one hook.
Preserved behaviour: identical UI; the Playwright user journey still passes.
```

#### Phase 5 — Cleanup

**5.1 Remove the old layers and sync the docs**
```
/refactor Delete the old lib back-end folders and bring AGENTS.md and the vault in line with the new architecture

Read vault/Architecture Overhaul Audit.md §6 and §4 F-18 first.
Scope: delete src/lib/{services,domain,data,sse,api} and lib/auth server files once nothing imports them, along with dead code (the commented-out seeds in achievements-db.ts, calcActiveDays if unused). Rewrite AGENTS.md "Repo Layout", "File Architecture" (the layers table) and the rules that name old paths. Update Domain Architecture, Data Model And API Reference and Developer Handbook, and mark Architecture Review as superseded by the design spec.
Done when: no import path references the removed folders, and npm run lint, typecheck, test:run and test:e2e pass.
```

---

## Related notes

- [[Architecture Review]] — the previous review; several of its "resolved" items are re-examined in §4
- [[Domain Architecture]] · [[Data Model And API Reference]] — the current system in depth
- [[Known Issues]] — open issues F-14 refers to
- [[UI Overhaul Design Spec]] — the design direction §7.6 would affect

[[Guides Index]]
