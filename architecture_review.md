# ⚡ FitLevelUp — Architecture Review

> **Stack:** Next.js 16 App Router · MongoDB + Better-Auth · Upstash Redis SSE · TanStack Query

---

## 01 — Data Flow Architecture

### Full Request Lifecycle — Log a Workout

```
Browser
  │
  ▼
Middleware (proxy.ts)
  │  Validate session via better-auth
  │
  ▼
API Route (workouts/route.ts)
  │  Rate limit check → Zod schema parse
  │
  ▼
Service (log-workout.ts)
  │  validateWorkoutInput()   [pure domain]
  │  calcWorkoutXP()          [pure domain]
  │  startSession() → withTransaction()
  │    ├── getUserFromDb()
  │    ├── calcStaminaCost()       [pure domain]
  │    ├── calcExhaustionDebuff()  [pure domain]
  │    ├── insertWorkout()
  │    ├── updateQuestProgress()
  │    ├── grantUserXP()
  │    ├── updateUserStatsInDb()
  │    ├── updateUserStreakOnActivity()
  │    └── updateUserStaminaInDb()
  │  ← commit transaction
  │
  │  [After transaction — fire & forget]
  ├──▶ publishToUser() via Upstash Redis  [levelUp SSE toast]
  └──▶ evaluateAchievements()             [async, no await]
  │
  ▼
201 { workout } → Browser
```

### The 4-Layer Stack

| Layer                    | Location                   | Responsibility                                           |
| ------------------------ | -------------------------- | -------------------------------------------------------- |
| **HTTP Boundary**        | `src/app/api/*/route.ts`   | Auth, rate-limit, Zod parse. No business logic.          |
| **Application Services** | `src/lib/services/**/*.ts` | Orchestrates domain + persistence + side effects.        |
| **Domain Logic**         | `src/lib/domain/*.ts`      | **Pure functions only.** Zero infrastructure imports.    |
| **Data Access**          | `src/lib/data/*-db.ts`     | Dumb persistence. Wraps MongoDB. Owns `toXxx()` mappers. |

---

## 02 — Design Patterns In Use

### 🏗 Creational

**Singleton (MongoDB Connection Pooling)**

- `mongodb.ts` uses `global._mongoClientPromise` to prevent hot-reload from spawning extra clients in development.

**Factory Function**

- `getCollection<WorkoutDoc>("workoutsCollection")` acts as a typed factory hiding all connection details from callers.

**Lazy Initialization**

- `getRedis()` in `sse-publisher.ts` creates a Redis client on-demand per call — correctly stateless for Vercel's serverless model.

---

### 🔧 Structural

**Adapter / Data Mapper**

- `toWorkout()`, `toUser()`, `toRun()` — each `*-db.ts` module owns a private mapper translating `ObjectId`/`Date` MongoDB documents into clean domain types (`WorkoutDoc → Workout`).

**Facade**

- `api-client/index.ts` is a barrel facade. Consumers import from one place, and the internals are split across 9 focused modules (`workouts.ts`, `runs.ts`, etc.).

**Decorator (Auth Guard)**

- `getAuthUserId()` acts as a consistent auth gate — every API route calls it first as a synchronized cross-cutting concern.

---

### 🎭 Behavioral

**Strategy (Quest Dispatch Table)**

- `QUEST_ACTIVITY_UPDATES` in `quest-rules.ts` is a type-safe dispatch table. Adding a new activity type (e.g., `yoga_session`) requires zero changes to calling code — just a new entry in the table.

**Optimistic Locking (Retry Loop)**

- `grant-user-xp.ts` uses a `__v` version field + retry loop to prevent XP race conditions without full pessimistic locks or advisory locks.

**Observer / Event-Driven**

- Side effects (level-up SSE notification, achievement evaluation) are decoupled from the transaction using fire-and-forget `async` patterns with `.catch()` error boundaries. The DB transaction never waits on them.

---

## 03 — Code Smells & Issues

### 🔴 HIGH — Dead Commented-Out Code

**File:** `src/lib/data/achievements-db.ts`

~40 lines of achievement seeding logic is commented out. This is a code graveyard — it adds cognitive noise and implies the seeding approach was abandoned mid-refactor without cleanup.

**Fix:** Delete it entirely. The data lives in MongoDB. The seed script handles setup. Dead code is misleading documentation.

---

### 🟠 HIGH — Wrong HTTP Status Codes [✅ RESOLVED]

**File:** `src/app/api/workouts/route.ts` (and replicated in ~8 other routes)

_Note: This was resolved by implementing the `handleApiError` utility and semantic error classes (`AppError`). Unhandled server crashes now correctly return `500 Internal Server Error`, while domain exceptions return appropriate statuses like `400`, `401`, `404`, and `409`._

```typescript
// BEFORE (smell) — catch-all returns 400 for everything
const message = err instanceof Error ? err.message : "Invalid request";
return NextResponse.json({ error: message }, { status: 400 }); // ← WRONG

// AFTER (fix) — distinguish domain errors from infra errors
if (
  err instanceof Error &&
  err.message === "This workout was already logged."
) {
  return NextResponse.json({ error: err.message }, { status: 409 });
}
return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
```

---

### 🟡 MEDIUM — Two Conflicting Streak Functions

**File:** `src/lib/domain/user-rules.ts`

The domain has **two** streak calculation functions:

- `calcNewStreak()` — called during activity, increments the stored streak
- `calculateStreak()` — recalculates from an array of dates; appears **unused** in any service

**Fix:** Audit usages. If `calculateStreak()` is truly dead, delete it.

---

### 🟡 MEDIUM — Business Logic Leaking Into the Data Mapper

**File:** `src/lib/data/user-db.ts` — `toUser()` function

The `toUser()` Data Mapper (Layer 4) is executing non-trivial domain rules:

1. Calling `calcRecoveredStamina()` — a stamina domain calculation
2. Containing inline streak display validation logic

A mapper's only job is type translation.

```typescript
// BEFORE (smell — domain logic IN the mapper)
function toUser(doc: UserMongoDoc): User {
  const recoveredStamina = calcRecoveredStamina(...); // ← domain rule!
  if (displayStreak > 0 && lastActivityStr !== today) {
    displayStreak = 0; // ← domain rule!
  }
}

// AFTER (fix — mapper is dumb, service applies rules)
function toUser(doc: UserMongoDoc): UserRaw { /* just maps fields */ }
// In the service layer:
const raw = await getUserFromDb(userId);
const stamina = calcRecoveredStamina(raw.stamina, raw.lastStaminaUpdate, new Date());
```

---

### 🔵 LOW — Hardcoded SSE Duration

**File:** `src/app/api/friends/events/route.ts`

```typescript
export const maxDuration = 60; // "increase to 300 for Vercel Pro"
```

Should be driven by an env var so upgrading Vercel plans doesn't require a code change.

---

### 🔵 LOW — Missing Env Var Validation for Upstash Redis

**File:** `src/env.ts`

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are **not** declared in `env.ts`. A missing Vercel env var causes a runtime crash, not a clean startup failure.

```typescript
// Add to env.ts server section:
UPSTASH_REDIS_REST_URL: z.string().url(),
UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
```

---

## 04 — Architectural Deepening Opportunities

### Candidate A — Unified UserStateService ⭐ Strong [✅ RESOLVED]

Currently, updating a user requires 6+ separate DB calls across 3 files. A deep `UserStateService` hides all mutations behind a narrow seam:

```
// BEFORE — log-workout.ts makes 6 DB calls
await updateQuestProgress(...)
await grantUserXP(...)
await updateUserStatsInDb(...)
await updateUserStreakOnActivity(...)
await updateUserStaminaInDb(...)

// AFTER — log-workout.ts makes 1 service call
await userState.applyActivity(userId, { xp, workout, stamina }, session);
```

---

### Candidate B — Route Error Handler HOF [✅ RESOLVED VIA UTILITY]

We explored creating a `withApiHandler()` wrapper, but ultimately chose to implement a centralized `handleApiError` utility function. This allowed us to keep the explicit `try/catch` blocks in every route for better debugging traceability, while reducing the catch block to a single, standardized line: `return handleApiError(err);`.

```typescript
// src/lib/api/with-api-handler.ts
export function withApiHandler(fn: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (err instanceof z.ZodError)
        return NextResponse.json(
          { error: err.issues[0]?.message },
          { status: 400 },
        );
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}
```

---

### Candidate C — Vercel Deployment Readiness ⭐ Strong — Do This First

|     | Item                                                                       | Priority              |
| --- | -------------------------------------------------------------------------- | --------------------- |
| ✅  | Add `UPSTASH_REDIS_*` to `env.ts`                                          | **Fix before deploy** |
| ✅  | Verify `BETTER_AUTH_URL` is set in Vercel env vars                         | **Fix before deploy** |
| ✅  | Wrap fire-and-forget promises in `waitUntil()` (`log-workout.ts` & others) | **Fix before deploy** |
| ✅  | Confirm `migrate-db.ts` targets Atlas (not Docker) on Vercel build         | Verify                |
| ✅  | Run seed script against Atlas cluster before go-live                       | Manual step           |
| ⚠️  | SSE drops every 60s on Hobby plan — add "reconnecting" UI state            | Nice to have          |
| ⚠️  | Remove `console.log` from `evaluate-achievements.ts`                       | Nice to have          |

---

### Candidate D — Purify the Data Mapper [✅ RESOLVED]

The `toUser()` mapper in the data layer (`user-db.ts`) is currently a shallow module that leaks business logic by computing `calcRecoveredStamina` and validating streak breakage.

**Solution:** Make `toUser()` a dumb type translator. Move the stamina and streak evaluation behind the seam of the `UserStateService` so the service layer is responsible for assembling the fully computed `User`.
**Benefits:** Restores locality to the game logic and makes the mapper instantly testable without mocking time or game config.

---

### Candidate E — Deepen the Domain with a Workout Evaluator [✅ RESOLVED]

The `logWorkout` service is a transaction script that orchestrates multiple pure domain rules step-by-step before committing to the DB. It acts as a shallow adapter, meaning the core game loop can only be tested using full database integration tests.

**Solution:** Extract a new deep module in the domain layer: `WorkoutEvaluator`. It takes the workout input and current user state, runs all rules, and returns a `WorkoutResult`. The service layer simply passes this result to the database.
**Benefits:** Massive leverage in testing (you can unit-test the entire workout outcome purely) and narrows the service layer interface.

---

## 05 — Authentication & Authorization

### The Framework: `better-auth`

The application uses **[better-auth](https://better-auth.com/)** with the `mongodbAdapter` as the core identity provider.

- **Provider:** Email and Password (configured in `src/lib/auth/server.ts`).
- **Session Storage:** Server-side sessions persisted in MongoDB.

### Authorization Method: The Decorator Pattern

There is no complex Role-Based Access Control (RBAC) yet. Authorization is handled via a simple but effective decorator-style gatekeeper: `getAuthUserId()`.

1. **The Gatekeeper (`auth-helpers.ts`):**
   Reads the incoming request headers and checks `auth.api.getSession()`. If no valid session exists, it deliberately throws `new Error("Unauthorized")`.
2. **The Route Handlers (`route.ts`):**
   Every protected API route begins by calling `const userId = await getAuthUserId();`.
3. **The Error Boundary:**
   The pervasive `try/catch` block in every route handler catches that specific `"Unauthorized"` error string and returns a `401` HTTP response.

**Architectural Assessment of Auth:**

- **Pros:** It's extremely explicit. You can't accidentally expose a protected route because you must call `getAuthUserId()` to get the `userId` needed for any database query.
- **Cons:** Initially, it relied on throwing a generic `Error` with a magic string (`"Unauthorized"`). This has since been resolved by introducing a semantic `UnauthorizedError` class and the centralized `handleApiError` utility, which cleanly translates it to a `401` response.

---

## 🏆 Top Recommendation

1. **Add `UPSTASH_REDIS_*` to `env.ts`** — fail fast at startup, not at runtime.
2. **Wrap background tasks in `waitUntil()`** — prevent Vercel from freezing container mid-execution.
3. **Seed MongoDB Atlas** with achievements and quests. Vercel build does NOT run the seed script.
4. **Delete the commented-out code** in `achievements-db.ts` — 2-minute cleanup.

> **Overall assessment:** This is a genuinely well-structured Next.js codebase. The 4-layer separation is clean, the pure domain layer is excellent, and the optimistic locking pattern for XP is sophisticated. The main technical debt is in error handling consistency and domain logic leaking into the data mapper. Both are fixable in a day.

---

## 06 — Upcoming Frontend Features (v1.1)

Based on our architectural review and brainstorming session, the following frontend-heavy gamification features are approved for the next development cycle before the Vercel deployment:

### 0. UI/UX Pro Max Overhaul (Modern Athletic) [DONE ✅ ]

A full transition from a generic SaaS look to a high-contrast, gamified athletic aesthetic.
- **Design Tokens:** Strict semantic CSS variables (`bg-background`, `bg-card`) ensuring perfect light/dark mode parity and OLED blacks.
- **Typography:** `next/font/google` optimized loading of **Barlow Condensed** (HUD headers/numbers) and **Barlow** (body).
- **Physical Interactions:** Replaced ad-hoc hover states with a globally consistent `.active-press` utility providing tactile, spring-physics scaling (200ms) on all interactable elements.

### 1. Interactive Human Anatomy UI [INITIALLY DONE ✅ ]

A visual representation of the human muscular system mapping to the `TargetMuscle` enum (`Chest`, `Back`, `Legs`, etc.). It will be implemented across 3 contexts:

- **The 7-Day Heatmap (Dashboard):** Evaluates workout history over the past 7 days. Muscle groups glow red/orange based on training volume, helping identify neglected muscle groups.
- **Live Session "Pump" Tracker (Workout View):** As exercises are added to an active session, the corresponding muscles light up instantly, acting as a visual checklist.
- **Recovery Monitor (Profile/Dashboard):** Evaluates fatigue. Muscles trained recently start red (exhausted) and slowly transition to green (recovered) over a 48-72 hour window.

### 2. Workout Templates [INITIALLY DONE ✅ ]

Frictionless workout entry. Allows users to save a collection of exercises as a named template (e.g., "Push Day", "Upper Body Power").

- **Data Layer:** Will require a new MongoDB collection or sub-document on the user profile (`Template[]`).
- **UX:** A 1-click "Start from Template" button on the workout screen that pre-populates the exercise list.

### 3. "Beat Your Ghost" (Personal Records Integration)

A gamified pacing mechanic utilizing the existing `PersonalRecord[]` data.

- **Live Target:** When logging an exercise (e.g., Bench Press) or a run, the UI fetches and displays the user's historical PR as the "Ghost to beat".
- **Social Hype:** If the user logs a value that exceeds their ghost, it triggers a confetti/explosion animation locally.
- **Event Integration:** Hooked into the Upstash Redis SSE system to broadcast a special achievement toast to all friends: _"Adrian just shattered their Bench Press record!"_

---

## 07 — Network Loss Resilience (Deep Edge Cases)

A specialized architecture review was conducted to address edge cases around network timeouts, idempotency, and partial failures (e.g., when a request reaches the server and is committed, but the response is lost before reaching the client). The following 6 candidates were identified and slated for implementation:

### 1. Stable Idempotency Keys at the Seam (Strong)
- **Problem:** `WorkoutForm` and `RunForm` generate `crypto.randomUUID()` at the call-site on every submit. A network timeout followed by a user retry generates a *new* key, bypassing the database idempotency index and creating duplicate workouts.
- **Solution:** Allocate the idempotency key in React state (`useState`) when the form mounts. Only reset it upon a successful `201 Created` response. 

### 2. Deepen `apiFetch` for Offline Resilience (Strong)
- **Problem:** `apiFetch` is a shallow wrapper around `fetch()`. A `TypeError: Failed to fetch` (offline) is thrown generically. There is no auto-retry mechanism.
- **Solution:** Deepen `apiFetch` to distinguish between `NetworkError` (e.g., offline) and `ServerError`. Add an automatic retry gate that only fires for `NetworkError`s on requests that provide an idempotency key.
- **Status:** ✅ COMPLETED

### 3. Graceful 409 Conflict Recovery (Strong)
- **Problem:** When the server correctly catches an idempotency duplicate (MongoDB error 11000), it throws a `ConflictError` which bubbles to the client as a generic red error message. The user thinks it failed, even though it succeeded.
- **Solution:** Add `findByIdempotencyKey` to the data layer. When `logWorkout` or `logRun` catch a duplicate key, they will fetch the existing entity and return it with a 200 OK (or 409 + body), allowing the frontend to treat it as a seamless success.
- **Status:** ✅ COMPLETED

### 4. Reliable Background Task Delivery (Strong)
- **Problem:** `after(evaluateAchievements(...))` is fire-and-forget. If the Vercel Function is killed mid-execution, the achievement is lost forever with no dead-letter queue.
- **Solution:** Keep `after()` for the fast-path, but add a reliable Vercel Cron sweep (`/api/cron/achievements-sweep`) that periodically re-evaluates locked achievements idempotently to ensure zero data loss.
- **Status:** ✅ COMPLETED

### 5. Atomic Quest Syncing (Strong)
- **Problem:** `syncUserQuests` uses a read-then-insert pattern (TOCTOU). Concurrent requests (e.g., logging a workout while claiming a quest) race to `bulkInsert` the same missing quests, causing an unhandled duplicate key crash.
- **Solution:** Refactor `syncUserQuests` to use MongoDB `bulkWrite` with `updateOne(..., { upsert: true, $setOnInsert })`. This makes the sync operation atomic and safe under high concurrency.
- **Status:** ✅ COMPLETED

---

## Future Features

### 6. Abort In-Flight Requests on Unmount
- **Problem:** `useEntityForm` does not cancel requests if the user navigates away. The delayed response triggers a `setState` on an unmounted component (memory leak) and invalidates caches unexpectedly.
- **Solution:** Thread an `AbortController` through `useEntityForm` and `apiFetch`. Abort the signal during the `useEffect` cleanup phase.
- **Status:** 🔜 FUTURE
