# FitLevelUp — Project Briefing

> A plain-English guide to everything important about this codebase.  
> Last updated: July 2026

---

## 1. What Are We Building, and Why?

**FitLevelUp** is a gamified fitness tracker. Instead of just logging that you ran 5km or did 3 sets of bench press and moving on, the app turns every workout and run into an RPG-style experience. You earn XP, level up, maintain daily streaks, complete time-limited quests, and unlock achievement badges.

**The core idea:**  
Most fitness apps are boring. They capture data but give you no emotional reward for showing up. FitLevelUp borrows the motivational psychology of games — progression loops, rewards, and visual feedback — to make you _want_ to keep training.

**What users can do right now:**

- Log gym workouts (exercises, sets, reps, weight, duration)
- Log runs (distance, duration, difficulty — pace auto-calculated)
- Watch their XP bar fill up and level up (every level costs `level × 500 XP`)
- Maintain a daily activity streak (breaks if you skip a day; a day is the user's own calendar day in their time zone, captured from the browser at signup)
- Complete daily, weekly, and special quests (e.g. "Do 3 workouts this week")
- Unlock achievement badges (e.g. "First Run", "Level 10", "30-day streak")
- View a dashboard with weekly stats and a heatmap of active days
- Manage a stamina system — overtraining costs more XP (exhaustion debuff)
- Create custom exercises and reuse them across sessions
- Fully authenticated accounts (email/password via Better Auth)
- **Add friends by User ID**, accept/decline incoming requests, and remove friends
- **View a friend's profile modal** — see their level, streak, total workouts, distance, and personal records (heaviest lifts, fastest 5K/10K, longest run)
- **Receive notifications** in a bell inbox — friend requests, accepted requests, friends' level-ups and your own achievement unlocks are kept for 90 days, and a toast shows for entries that arrive while you are looking

---

## 2. What's the Structure and Architecture?

The project is a **Next.js 16 full-stack app** (App Router). Everything — frontend, API, database — lives in one codebase. The backend follows a strict 4-layer architecture:

```
Browser (React + TanStack Query)
        │
        ▼
API Routes  ← thin controllers (parse request, call service, return JSON)
        │
        ▼
Services    ← use-case orchestration (the "what happens when you log a workout")
        │
        ├── Domain Layer  ← pure math/business logic (no DB, no network)
        └── Data Layer    ← MongoDB CRUD only (no business logic)
```

### The 4 Layers in Plain English

| Layer          | Where It Lives      | Job                                                                                                 |
| -------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| **API Routes** | `src/app/api/`      | Get the user's ID from the session cookie, call the right service, return the result. Nothing else. |
| **Services**   | `src/server/<module>/**/<noun>.service.ts` | Orchestrate everything. Call domain rules → call DB → trigger side effects.          |
| **Domain**     | `src/server/<module>/**/<noun>.rules.ts` | Pure functions. XP formulas, streak logic, stamina calculations. No database imports, ever. |
| **Data**       | `src/server/<module>/**/<noun>.repository.ts` | Raw MongoDB access, scoped by `userId`. Convert DB documents to TypeScript types. No business logic. |

### Frontend

- **React 19** with the Next.js App Router (server components where possible, client components for interactive UI)
- **TanStack Query v5** for all data fetching, caching, and mutation state
- **`useCurrentUser`** (`src/lib/progression/hooks/`) reads the currently logged-in user through the shared query cache, so any component can read it
- **Tailwind CSS v4** for styling

### Database

- **MongoDB 7** — either local (Docker) or cloud (Atlas)
- Uses a **Replica Set** even locally, because MongoDB multi-document transactions require one
- Mongoose is NOT used — the native MongoDB driver is used directly, with typed collection wrappers

### Local Development Setup

To run the app locally you need **two infrastructure services**:

| Service                     | How to Run                   | Required For                              |
| --------------------------- | ---------------------------- | ----------------------------------------- |
| **MongoDB 7 (Replica Set)** | `docker compose up -d`       | Everything — workouts, runs, quests, auth |
| **Upstash Redis (cloud)**   | Set env vars in `.env.local` | Rate limiting                             |

**Why can't Redis just be a local Docker container?**  
The rate limiter uses `@upstash/redis`, which speaks Upstash's **HTTP REST API** — not raw TCP Redis. A standard `redis:alpine` container is not compatible. You must point to a real Upstash endpoint. Free tier is sufficient for local dev.

**Required `.env.local` variables for a full local setup:**

```bash
# MongoDB (swap for Docker URI if not using Atlas)
MONGODB_URI="mongodb://127.0.0.1:27017/?directConnection=true"
MONGODB_DB="fitlevelup"

# Auth
BETTER_AUTH_SECRET="any-long-random-string"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"

# Upstash Redis — get free credentials at https://console.upstash.com/
UPSTASH_REDIS_REST_URL="https://<your-instance>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="<your-token>"
```

> **Note:** If `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are missing, the rate limiter lets requests through and logs the error.

### Game Balance Configuration

All the "magic numbers" that control how the game feels live in one file:

```
src/lib/config/game-config.ts
```

```
Workout XP = (duration × 2) + (exerciseCount × 15)
Run XP     = (distance × 10) + (duration × 2)  × difficulty multiplier
Level cost = level × 500 XP
Stamina cost per workout = 15 + (duration × 0.5)
Stamina recovery = 50 per day
```

### Full Folder Map

```
src/
├── app/
│   ├── api/               ← All REST endpoints
│   ├── (app)/             ← Protected pages (dashboard, workouts, runs, quests, profile)
│   ├── (auth)/            ← Login / Sign-up pages
│   └── (landing)/         ← Public marketing page
├── components/            ← React UI: ui/ primitives and shared/ app-shell components
├── server/                ← The whole back end ("server-only")
│   ├── runtime.ts         ← Composition root: wired defineRoute, outbox dispatcher, listeners
│   ├── platform/          ← config, env, domain errors, auth/, database/, events/, http/
│   └── progression/ quests/ training/ achievements/ social/ notification/   ← feature modules
├── shared/                ← Zod contracts, wire types and calendar helpers used by both sides
├── lib/                   ← Browser side only
│   ├── <domain>/          ← One folder per client domain: keys.ts, api.ts, hooks/
│   ├── shared/            ← api-fetch.ts (apiFetch, ApiError)
│   ├── auth/client.ts     ← Better Auth browser client
│   ├── constants/  hooks/  utils/   ← Shared constants, custom hooks, formatters
│   └── env.ts             ← The one browser-readable environment variable
├── testing/               ← Test helpers (seedPlayer, transactions)
├── scripts/               ← DB migration runner and numbered migrations
└── proxy.ts               ← Next.js edge middleware (route protection)
```

### What Happens When You Log a Workout (The Full Flow)

This is the most important sequence to understand. Every workout log triggers a transaction and background side-effects:

```
POST /api/workouts
  1. defineRoute: session      ← verify auth, then the rate limit
  2. defineRoute: Zod parse    ← sanitize input

  → logWorkout() service
      3. Domain validation (pure): is the input valid?
      4. Domain calculation (pure): how much XP, what stamina cost?

      ─── MongoDB Transaction (all-or-nothing) ──────────────────────
      5. getPlayerState()          ← read stamina (for debuff calculation)
      6. insertWorkout()           ← save the workout
      7. updateQuestProgress()     ← update quest counters
      8. recordActivity()          ← write the XP ledger row, then update XP, streak, stamina and totals on the player profile; emits progression.leveled-up on a level change
      ───────────────────────────────────────────────────────────────

      (the same transaction also writes an `activity.logged` outbox row)

      9. achievements.evaluate     ← [outbox listener, run via `after()`] check if any badges unlock

  ← return the Workout to the client
```

---

## 3. What Have We Done So Far, and Why?

### ✅ What's been built and shipped

**Core Features (all working):**

- Full authentication (sign up, sign in, sign out, session management)
- Workout logging with the full XP/streak/quest/achievement side-effect chain
- Run logging with the same full side-effect chain
- Quest system (daily, weekly, special) with progress tracking and XP claim
- Achievement system with rarity tiers (common, rare, epic, legendary)
- Stamina system with daily recovery and exhaustion XP debuff
- Dashboard with weekly workout/run stats
- Custom exercises (create, reuse across workouts)
- Full CRUD for workouts and runs (create, list with pagination, edit, delete; both reverse the activity's XP, totals, quest progress and, on delete, the streak)
- Profile page with personal records
- **UI & UX Overhaul (Modern Athletic Style):**
  - Transitioned from generic SaaS design to a high-contrast, gamified athletic HUD aesthetic.
  - Implemented strict CSS token hierarchy (OLED blacks, vibrant accents) and globally optimized fonts (Barlow Condensed / Barlow).
  - Adopted tactile `.active-press` spring-physics animations for all interactive surfaces.
- **Interactive Human Anatomy UI:**
  - 7-Day Heatmap (Dashboard widget) to visualize trained vs neglected muscles
  - Live Session "Pump" Tracker (Workout Form) with dynamic SVG highlighting
- **Workout Templates (fully implemented):**
  - Save a collection of exercises as a named template (e.g. "Push Day")
  - 1-click "Templates" modal in the workout form for frictionless data entry
  - Dedicated `/templates/new` builder UI with quick exercise selection
- **Friend System (fully implemented):**
  - Send/accept/decline friend requests by User ID
  - Remove friends
  - Friend cards show level, streak, and link to a detailed profile modal
  - Friend profile modal: avatar, name, level, streak, total workouts, total distance, and full personal records (top lifts, fastest 5K/10K, longest run)
  - Personal records calculated on-the-fly from all workouts and runs at query time
  - Notification inbox in MongoDB with polling delivery, an unread bell and one live toast

**Infrastructure:**

- Strict 4-layer architecture (domain/service/data separation fully enforced)
- MongoDB transactions wrapping all multi-step writes (`logWorkout`, `logRun`, `claimQuestReward`)
- `Idempotency-Key` header on workout, run and template creation (a retry replays the stored result; a changed body under the same key is refused)
- Proper MongoDB indexes on all hot-path queries (including unique indexes that keep friendships to one document per pair and prevent duplicate achievement unlocks, custom exercises and quest rows)
- Zod validation on every API endpoint
- Type-safe environment variables (validated at startup — server won't start with missing env vars)
- Unit tests (Vitest + in-memory MongoDB) covering domain rules, data layer and service layer
- Service layer uses `targetUserId` (the other person's ID) — no internal document IDs exposed to frontend

**Code quality improvements already applied (from the P0/P2 audit fixes):**

- Game balance constants extracted from magic numbers into `game-config.ts` (was P2 item #10; they now live in `src/server/platform/config.ts`)
- The current user is read through TanStack Query (`invalidateQueries`) instead of the `window` event bus anti-pattern (was P2 item #11)
- Dead batch fetch in `updateQuestProgress` removed
- XP race condition in `grantUserXP` fixed (read moved inside the session)
- Auth errors now return proper `401` status codes instead of being swallowed as `400`

**Architectural Refactors (Vercel Compatibility & Deep Modules):**

- **Transactional outbox:** Background side effects (achievement evaluation and the notification inbox writes) are outbox rows written in the caller's transaction and delivered with the Next.js `after()` API once the response is sent, so a function killed after commit delays them but never loses them.
- **Progression module:** `src/server/progression` owns XP, level, streak, stamina and totals in the `player_profiles` collection. `recordActivity` (workouts and runs) and `grantXp` (quest claims) share one XP path that writes an `xp_ledger` row, increments `totalXp` and emits `progression.leveled-up` when the level passes `highestLevel`, so a level lost and re-earned announces nothing. Editing or deleting an activity goes through `replaceSourceXp` and `revokeSource`, which replace or remove the activity's ledger row and set `totalXp` to the ledger sum, so the level can fall. Level and `xpToNextLevel` are computed from `totalXp`.
- **Quests and training modules:** `src/server/quests` owns the quest definitions (typed constants with stable string ids), period rules, sync, progress and claim. `src/server/training` owns workouts, runs, templates, custom exercises and records; personal records and run stats are computed by database aggregation. Workout and run dates are returned as ISO instants and formatted in the user's time zone by the client.
- **Pure Data Mappers:** Dynamic state assembly (calculating stamina recovery, zeroing a broken streak) happens in progression's `getPlayerState`, not in the data layer; `getUser` in progression composes the account and the player state into the `User` the API returns.
- **Pure Domain Evaluators:** Extracted complex orchestration out of transaction scripts (`logWorkout`, `logRun`) into deep, pure domain modules (`WorkoutEvaluator`, `RunEvaluator`). This cleanly separates the calculation of the "game loop" outcome from persistence, enabling rapid, 100% pure unit testing of all activity rules.
- **Vitest Mocking:** Added a global `vitest.setup.ts` to elegantly mock the Next.js `next/server` `after()` API (handling both callbacks and Promises) without wiping out `NextResponse`, keeping the test suite fast and 100% green.
- **Centralized API Error Handling:** Migrated all services to throw semantic exceptions (`ConflictError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, plus `DomainError` from the domain rules) and built every API route with `defineRoute`, which maps thrown errors in one place (`toErrorResponse`), ensuring consistent HTTP status codes across the app.

### Why was it built this way?

- **Clean Architecture:** Pure domain layer means XP formulas and streak logic can be unit tested without ever touching a database. Fast, reliable tests.
- **MongoDB transactions:** Logging a workout touches 6+ collections. Without a transaction, a crash halfway through would leave the user with XP but no streak update, or a quest update but no achievement check. Transactions make it atomic.
- **Idempotency keys:** Mobile apps retry requests. Without these, a user on a bad connection could get XP credited twice for the same workout.
- **TanStack Query:** Gives automatic caching, background refetching, and loading/error states for free. Avoids manual `useEffect` fetch patterns.

---

## 4. What's the Current Goal?

The current focus is on two parallel tracks:

### Track A — P3 System Design Improvements

These are architectural upgrades that make the system more scalable and robust. None of them fix bugs (the P0s are done) — they make the system better for the future.

**P3 items to complete:**

| #   | What                       | Why It Matters                                                                                                                                                                              |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19 | **Centralized error handling (COMPLETED)** | Every API route had its own `try/catch` with slightly different error handling. We standardized this using semantic error classes and `defineRoute`, which maps them in one place. |

---

### Track B — Friend System (Real-Time Updates Showcase) ✅ COMPLETED

This feature has been fully implemented. It serves two purposes:

1. **Product value:** Users can add friends, see their stats, and compete socially — a huge motivation multiplier for fitness apps.
2. **Technical showcase:** Demonstrates **near-real-time updates** with a persistent inbox. When your friend accepts a request, a toast appears within about 30 seconds without refreshing, and the entry waits in the bell if you were away.

### Track C — Network Loss Resilience & Concurrency ✅ COMPLETED

This track was completed to eliminate edge-case bugs that occur during bad network conditions or high concurrency.

**What was built:**

1. **Client-Side Idempotency (`useIdempotencyKey`)**: Create forms generate one UUID when they mount, keep it stable across re-renders and retries, and start a new one after a success or a `422`. `apiFetch` sends it as the `Idempotency-Key` header.
2. **API Fetch Retries**: `apiFetch` was upgraded to catch `TypeError` (offline/network drops) and automatically retry GET requests and requests that carry an `Idempotency-Key` header up to 2 times, one second apart. Updates and deletes are not retried.
3. **Replay on retry**: If a duplicate request reaches the server (because a previous request succeeded but the response was dropped), `createOnce` finds the _already created_ document by its key and returns it as a `201` with `Idempotent-Replayed: true`; the unique index on `idempotencyKey` settles two racing requests. If the same key arrives with a different body, the server answers `422` and the form tells the person their earlier submit was saved.
4. **Atomic Quest Syncing (TOCTOU fix)**: Eliminated a read-then-write race condition by leveraging MongoDB `bulkWrite` with `updateOne(..., { upsert: true, $setOnInsert })` for quest syncing, letting the database handle deduplication atomically.
5. **Reliable Background Tasks (Cron)**: A daily Vercel Cron sweep (`/api/cron/outbox-sweep`) delivers any outbox row the `after()` dispatch did not finish, retrying failed listeners with backoff. This is the safety net when the Next.js `after()` task is killed by Vercel's serverless timeout.

**What was built:**

#### Data Model

- `friendships` MongoDB collection with fields: `requesterId`, `receiverId`, `status` (`pending` | `accepted` | `declined`)
- Unique compound index on `(requesterId, receiverId)` — prevents duplicate requests
- Sparse index on `status` — fast query for pending/accepted lists

#### API Endpoints

| Method   | Endpoint                    | What It Does                                           |
| -------- | --------------------------- | ------------------------------------------------------ |
| `POST`   | `/api/friends/request`      | Send a friend request by target User ID                |
| `POST`   | `/api/friends/[id]/accept`  | Accept a request (using target's User ID)              |
| `POST`   | `/api/friends/[id]/decline` | Decline a request (using target's User ID)             |
| `GET`    | `/api/friends`              | List your accepted friends with their profile |
| `GET`    | `/api/friends/requests`     | List pending incoming requests with requester profile  |
| `DELETE` | `/api/friends/[id]`         | Remove a friend (using target's User ID)               |
| `GET`    | `/api/friends/[id]/records` | One friend's personal records (accepted friends only)  |
| `GET`    | `/api/notifications`        | Your inbox, with `?since=` and the unread count        |
| `PATCH`  | `/api/notifications/read`   | Mark entries read                                      |

> **Important design decision:** All friendship mutation endpoints accept the **other user's `userId`** (not an opaque MongoDB `_id`). The backend internally resolves the correct `Friendship` document from the pair key of the current user and the target user. This was a deliberate refactor to fix a bug where the frontend was passing the wrong ID type.

#### Notifications

- `src/server/notification` — listener-only. The outbox listeners turn `friendship.requested`, `friendship.accepted`, `progression.leveled-up` (to each accepted friend) and `achievement.unlocked` into rows in the `notifications` collection, one per recipient, so offline users and second tabs see them too. Entries expire after 90 days.
- `GET /api/notifications?since=` and `PATCH /api/notifications/read` serve the inbox.
- `src/lib/notifications/hooks/useNotifications.ts` — client hook. Polls every 30 seconds while the tab is visible, on focus and, for 10 seconds after the user's own successful action, every 2 seconds. `NotificationCenter` shows one toast for entries that arrive while the user is looking, the bell shows the unread count, and the tab title carries it.

#### Friend Page UI

- Three tabs: **My Friends**, **Requests** (with unread badge count), **Add Friends**
- Add Friends tab uses User ID lookup (not username/email search) — shows a preview of the found user before sending
- `FriendCard` — clickable card that opens the profile modal on click
- `FriendProfileModal` — modal with: gradient cover, avatar, level/streak badges, total workouts/distance stats, and a full personal records list (strength, cardio, endurance icons)
- `FriendRequestCard` — shows requester's avatar, name, level with Accept/Decline actions
- Personal records load when the modal opens, from `GET /api/friends/[id]/records`, which answers `404` unless the pair is accepted; the friend list itself carries none

#### Business Rules (`src/server/social/friendship.rules.ts`)

- Cannot send a request to yourself
- Cannot send a duplicate request: the pair has one document, keyed by `pairKey`, and an existing pending or accepted pair answers `409 "Friend request already sent."`
- Only the receiver can accept or decline a pending request
- Either party can remove a pending or accepted friendship; a declined pair answers `404`, so a decline stays silent
- After a decline, the person who was declined cannot re-request for 7 days (`GAME_CONFIG.social.friendRequestCooldownDays`) and gets the same `409`; the person who declined can request at any time, which reopens the same document with the roles swapped

---

## Quick Reference: Key Files to Know

| File                                                                                        | What It Does                                                                               |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [workout.service.ts](file:///z:/Projects/fit_level_up/src/server/training/workouts/workout.service.ts) | The most important file. The workout use cases, including the full logging orchestration. |
| [progression.rules.ts](file:///z:/Projects/fit_level_up/src/server/progression/progression.rules.ts) | XP leveling, streak calculation, stamina recovery — the core game math.            |
| [config.ts](file:///z:/Projects/fit_level_up/src/server/platform/config.ts)                  | Every balance constant. Change here to tune the game feel.                                 |
| [index.ts](file:///z:/Projects/fit_level_up/src/server/progression/index.ts)                | The progression module's public API: player state, activity and XP writes, level rules.    |
| [contracts](file:///z:/Projects/fit_level_up/src/shared/contracts)                          | Request schemas and the response types the browser and server share. The "language" of the whole app. |
| [useCurrentUser.ts](file:///z:/Projects/fit_level_up/src/lib/progression/hooks/useCurrentUser.ts) | Client hook for the logged-in user, shared through the query cache. Used everywhere.       |
| [proxy.ts](file:///z:/Projects/fit_level_up/src/proxy.ts)                                   | Next.js middleware — redirects unauthenticated users to login.                             |
| [schema.ts](file:///z:/Projects/fit_level_up/src/server/platform/database/schema.ts)        | Collection names, document types, indexes and validators. Applied at build by `applySchema`. |
| [friendship.rules.ts](file:///z:/Projects/fit_level_up/src/server/social/friendship.rules.ts) | The transition table: who can accept, decline, remove or reopen a friendship, and the cooldown. |
| [notification.listeners.ts](file:///z:/Projects/fit_level_up/src/server/notification/notification.listeners.ts) | Outbox listeners that write the notification inbox.                                        |
| [useNotifications.ts](file:///z:/Projects/fit_level_up/src/lib/notifications/hooks/useNotifications.ts) | Client hook — polls the inbox, runs the fast window and picks what to toast.         |
| [stats.service.ts](file:///z:/Projects/fit_level_up/src/server/training/stats/stats.service.ts) | Dashboard stats, top lifts and fastest runs, computed by database aggregation instead of loading the history. |
| [quest.definitions.ts](file:///z:/Projects/fit_level_up/src/server/quests/quest.definitions.ts) | Every quest as a typed constant with a stable id; achievements live in `src/server/achievements`. |

---

## Known Issues (Still Open)

| Priority | Issue                          | Status    |
| -------- | ------------------------------ | --------- |
| ✅ Done  | Centralized API error handling | Completed |
| ✅ Done  | Friend System + notification inbox | Completed |

|

---

## 5. Testing — How We Test, and Why It Works

There are three levels of tests in this project. Each level tests a different "slice" of the code, and they work together to give confidence that nothing is broken.

```
Test Pyramid (bottom = fastest/most tests, top = slowest/fewest)

        ┌──────────────────────────────┐
        │       E2E (Playwright)       │  ← Full browser, real server
        ├──────────────────────────────┤
        │  Service Integration Tests   │  ← Real logic + real in-memory DB
        ├──────────────────────────────┤
        │  Data Layer Tests            │  ← Real DB calls, no business logic
        ├──────────────────────────────┤
        │     Unit Tests (Domain)      │  ← Pure math. No DB. Instant.
        └──────────────────────────────┘
```

### How the Test Infrastructure Works

Before any test runs, Vitest fires a **global setup** ([vitest.global-setup.ts](file:///z:/Projects/fit_level_up/vitest.global-setup.ts)):

```typescript
// vitest.global-setup.ts
import { MongoMemoryReplSet } from "mongodb-memory-server";

export async function setup() {
  // Spins up a REAL MongoDB server in RAM — no disk, no external connection.
  // Uses a Replica Set (not standalone) because our service layer uses
  // MongoDB Transactions, which REQUIRE a replica set.
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  // Injects the connection string so all code under test connects to this
  // in-memory DB automatically — no code changes needed in the tests.
  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGODB_DB = "testdb";
}

export async function teardown() {
  // Kills the in-memory server when all tests are done. Clean slate.
  await replSet.stop();
}
```

**What this means for you:** You never need a real MongoDB running to run tests. Just `npm test` and it spins up, runs, and shuts down entirely in memory. Tests are completely isolated from production data.

---

### Level 1 — Unit Tests (Domain Layer)

**File locations:** the module's `__tests__/` folder, beside the `*.rules.ts` file (`src/server/progression/__tests__/progression.rules.test.ts`)  
**What they test:** The pure game math functions — XP calculation, level-up logic, streak counting, stamina math.  
**Why they're fast:** Zero database. Zero network. Just JavaScript functions in, values out.

#### Example: Testing the Level-Up Formula

```typescript
// src/server/progression/__tests__/progression.rules.test.ts

describe('levelFromTotalXp', () => {
  it('adds XP without leveling up', () => {
    expect(levelFromTotalXp(100 + 50)).toEqual({ level: 1, xp: 150, xpToNextLevel: 500 });
  });

  it('levels up when XP exceeds the threshold', () => {
    // Level 1 costs 500 XP: 450 + 100 crosses it, leaving 50 toward level 2 (which costs 1000)
    expect(levelFromTotalXp(450 + 100)).toEqual({ level: 2, xp: 50, xpToNextLevel: 1000 });
  });

  it('handles multiple level ups at once', () => {
    expect(levelFromTotalXp(450 + 2000)).toEqual({ level: 3, xp: 950, xpToNextLevel: 1500 });
  });
});
```

The player profile stores one number, lifetime XP; level, XP into the level and XP to the next level are computed from it.

---

#### Example: Testing Streak Logic

```typescript
// src/server/progression/__tests__/progression.rules.test.ts

describe("calcNewStreak", () => {
  // Case 1: Brand new user logging their first ever activity
  it("should start a streak at 1 if no previous activity", () => {
    expect(calcNewStreak(undefined, undefined, new Date("2026-10-21T12:00:00Z"), "UTC")).toBe(1);
    //                   ↑ no streak    ↑ no last day
    // → streak starts fresh at 1
  });

  // Case 2: User logs twice on the same local day — streak shouldn't double count
  it("should keep streak the same if logging twice on the same local day", () => {
    expect(calcNewStreak(5, "2026-10-21", new Date("2026-10-21T12:00:00Z"), "UTC")).toBe(5);
    // → streak stays at 5, not 6
  });

  // Case 3: Back-to-back local days — extend the streak
  it("should extend streak if logging on the consecutive local day", () => {
    expect(calcNewStreak(5, "2026-10-20", new Date("2026-10-21T12:00:00Z"), "UTC")).toBe(6);
    // → 5 + 1 = 6
  });

  // Case 4: User skipped a day — streak resets back to 1
  it("should reset streak to 1 if there is a gap day", () => {
    expect(calcNewStreak(5, "2026-10-18", new Date("2026-10-21T12:00:00Z"), "UTC")).toBe(1);
  });

  // Case 5: The same instant is a different day in a different time zone
  it("should count the activity on the user's local day", () => {
    const instant = new Date("2026-10-20T23:00:00Z"); // 07:00 on the 21st in Manila
    expect(calcNewStreak(5, "2026-10-20", instant, "Asia/Manila")).toBe(6);
    expect(calcNewStreak(5, "2026-10-20", instant, "UTC")).toBe(5);
  });
});
```

**What this proves:** The streak logic handles the tricky edge cases — same day, consecutive day, gap, and a late-night or early-morning activity that falls on a different day in the user's time zone than in UTC. The rule gets "now" as an argument, so no test needs a fake clock.

---

#### Example: Testing the Stamina System

```typescript
// src/server/progression/__tests__/progression.rules.test.ts

describe("calcRecoveredStamina", () => {
  // The stamina system is "lazy recovery" — it doesn't tick every second.
  // Instead, when you work out, the app calculates how much stamina you've
  // recovered since your last update.

  it("should recover 50 stamina if exactly one day has passed", () => {
    // Had 20 stamina, last updated yesterday → +50 → 70
    expect(
      calcRecoveredStamina(
        20,
        "2024-01-01T12:00:00Z",
        new Date("2024-01-02T12:00:00Z"),
      ),
    ).toBe(70);
  });

  it("should cap stamina at 100 after recovery", () => {
    // Had 80 stamina, last updated yesterday → +50 would be 130 → capped at 100
    expect(
      calcRecoveredStamina(
        80,
        "2024-01-01T12:00:00Z",
        new Date("2024-01-02T12:00:00Z"),
      ),
    ).toBe(100);
  });

  it("should not recover stamina if same day", () => {
    // Worked out twice today — no recovery between same-day sessions
    expect(
      calcRecoveredStamina(
        50,
        "2024-01-01T08:00:00Z",
        new Date("2024-01-01T18:00:00Z"),
      ),
    ).toBe(50);
  });

  it("should return 100 if no lastUpdateDate (new user)", () => {
    // New user or uninitialized — assume fully rested
    expect(
      calcRecoveredStamina(0, undefined, new Date("2024-01-01T12:00:00Z")),
    ).toBe(100);
  });
});

describe("calcExhaustionDebuff", () => {
  // If you don't have enough stamina to cover a workout's cost,
  // you earn half XP as a "pushed too hard" penalty.

  it("should NOT reduce XP if user has enough stamina", () => {
    // 50 current stamina, 30 cost — affordable, full XP
    expect(calcExhaustionDebuff(100, 50, 30)).toBe(100);
  });

  it("should reduce XP by 50% if user does NOT have enough stamina", () => {
    // 20 current stamina, 30 cost — can't afford it, half XP
    expect(calcExhaustionDebuff(100, 20, 30)).toBe(50);
  });

  it("should round the reduced XP", () => {
    // 101 * 0.5 = 50.5 → rounds to 51
    expect(calcExhaustionDebuff(101, 20, 30)).toBe(51);
  });
});
```

---

### Level 2 — Data Layer Tests (Integration)

**File locations:** `src/server/<module>/**/__tests__/<noun>.repository.test.ts`  
**What they test:** The raw MongoDB functions — do they correctly write to the DB, read back out, and map the document shape correctly?  
**Infrastructure:** Uses the same in-memory MongoDB from the global setup.

```typescript
// src/server/training/exercises/__tests__/custom-exercise.repository.test.ts

describe('custom-exercise repository Test', () => {
    const userId = "db-user-id";

    it('should create an exercise and assign an _id', async () => {
        const doc = await insertCustomExercise({
            userId,
            name: "DB Test Exercise",
            targetMuscle: TargetMuscle.Core
        });

        expect(doc.id).toBeDefined();
        expect(doc.userId).toBe(userId);
    });

    // MongoDB stores _id (ObjectId), but the app uses id (string).
    it('listCustomExercisesForUser should map _id to id correctly', async () => {
        const exercises = await listCustomExercisesForUser(userId);

        expect(exercises.length).toBe(1);
        expect(exercises[0].id).toBeDefined();
        expect(exercises[0]).not.toHaveProperty("_id");
    });
});
```

**What this proves:** The data layer correctly handles the MongoDB `_id` → `id` conversion and never leaks the internal `_id`.

---

### Level 3 — Service Integration Tests (The Most Important Layer)

**File locations:** `src/server/<module>/**/__tests__/` (for example `src/server/training/workouts/__tests__/`)  
**What they test:** The entire use-case from end to end — input goes in, business logic runs, database is written to, and the result is correct. This tests multiple layers working together.

#### Example 1: The Complete Workout Logging Flow

```typescript
// src/server/training/workouts/__tests__/log-workout.test.ts

describe('logWorkout Integration Test', () => {
  let userId: string;

  // Before ALL tests: seed a real account and player profile in the test DB
  beforeAll(async () => {
    userId = await seedPlayer({ email: "test@example.com", name: "Test User" });
  });

  afterAll(async () => {
    await deletePlayer(userId);
  });

  // After EACH test: wipe workouts so tests don't bleed into each other
  afterEach(async () => {
    const workoutsCol = await getCollection("workouts");
    await workoutsCol.deleteMany({});
  });

  // ─── TEST 1: The happy path ───────────────────────────────────────────
  it('should log a workout, calculate XP, and update user stats', async () => {
    const { value: workout } = await logWorkout({
      title: "Morning Lift",
      duration: 60,
      exercises: [
        { name: "Bench Press", targetMuscle: TargetMuscle.Chest, sets: 3, reps: 10, weight: 135 },
        { name: "Squats",      targetMuscle: TargetMuscle.Legs,  sets: 3, reps: 10, weight: 225 }
      ]
    }, userId, request());

    // The returned workout object should be correct
    expect(workout.id).toBeDefined();
    expect(workout.title).toBe("Morning Lift");
    expect(workout.xpEarned).toBeGreaterThan(0);

    // The player profile in MongoDB should reflect the workout
    const profile = await readProfile();
    expect(profile.totalWorkouts).toBe(1);                             // incremented by 1 ✅
    expect((await getPlayerState(userId)).xp).toBe(workout.xpEarned);  // XP granted ✅
    expect(profile.streak).toBe(1);                                    // streak started ✅
  });
```

**What this proves:** A full round-trip — the `logWorkout` service calls domain logic, writes to 3+ collections, and the user's stats are updated correctly in one atomic operation.

---

#### Example 2: Idempotency — Protecting Against Duplicate Submissions

```typescript
// ─── TEST 2: The "retry safety" test ─────────────────────────────────
it("replays a retry with the same key and body, and never credits XP twice", async () => {
  // The client generates one UUID per form mount and sends it as the Idempotency-Key header
  const request = { key: crypto.randomUUID(), fingerprint: "sha256-of-the-body" };

  // First request — creates the workout
  const first = await logWorkout(workoutInput, userId, request);
  expect(first.replayed).toBe(false);

  const xpAfterFirst = (await getPlayerState(userId)).xp;

  // Retry with the SAME key and body — replayed, nothing runs again
  const second = await logWorkout(workoutInput, userId, request);
  expect(second).toEqual({ value: first.value, replayed: true });
  expect((await getPlayerState(userId)).xp).toBe(xpAfterFirst);

  // Same key, different body — the earlier submit stands, so the retry is refused
  await expect(
    logWorkout(workoutInput, userId, { ...request, fingerprint: "a-different-body" }),
  ).rejects.toThrow(IdempotencyKeyReusedError); // 422

  expect(await workoutsCol.countDocuments({ userId, idempotencyKey: request.key })).toBe(1);
});
```

**What this proves:** A user on a flaky network who retries the same request cannot earn XP twice, and cannot have an edited retry silently swallowed. The unique index on `idempotencyKey` is the source of truth, `createOnce` turns a duplicate into a replay, and a changed body under a used key becomes a `422`.

---

#### Example 3: Stamina Recovery Before a Workout

```typescript
// ─── TEST 3: Lazy stamina recovery ───────────────────────────────────
it("should process lazy recovery before applying cost", async () => {
  // Arrange: user has 10 stamina, but it was updated 2 days ago
  const twoDaysAgo = new Date();
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

  await setProfile({ stamina: 10, lastStaminaUpdate: twoDaysAgo });

  // Act: log a 60-minute workout (cost = 10 + 60 × 0.2 = 22)
  await logWorkout(
    {
      title: "Recovered Workout",
      duration: 60,
      exercises: [
        {
          name: "Squats",
          targetMuscle: TargetMuscle.Legs,
          sets: 3,
          reps: 10,
          weight: 225,
        },
      ],
    },
    userId,
    request(),
  );

  // Assert:
  // Recovery:  10 stamina + (2 days × 100/day) = 210 → capped at 100
  // Cost:      100 - 22 = 78
  // Final:     78
  expect((await readProfile()).stamina).toBe(78); // ✅
});
```

**What this proves:** The lazy recovery runs correctly _before_ the stamina cost is applied, meaning a user who hasn't logged in 2 days gets their stamina back before it's drained.

---

#### Example 4: Business Rule Enforcement (No Duplicate Exercises)

```typescript
// src/server/training/exercises/__tests__/create-custom-exercise.test.ts

it("should prevent duplicate custom exercises with the same name and muscle group", async () => {
  // Create a valid exercise
  await createCustomExercise(
    userId,
    "Bulgarian Split Squat",
    TargetMuscle.Legs,
  );

  // Attempt to create the exact same exercise (even with different casing)
  await expect(
    createCustomExercise(userId, "bulgarian split squat", TargetMuscle.Legs),
    //                           ↑ lowercase — service normalizes it first,
    //                             so it's treated as the same exercise
  ).rejects.toThrow(
    "You already created an exercise with this name for this muscle group.",
  );

  // Confirm only ONE record in the DB
  const col = await getCollection("customExercises");
  const all = await col.find({ userId }).toArray();
  expect(all.length).toBe(1); // Not 2 ✅
});
```

**What this proves:** The service normalizes input (title-cases the name) before checking for duplicates, so "bulgarian split squat" and "Bulgarian Split Squat" are treated as the same thing. The deduplication rule is enforced both at the service layer (business logic) and via a database-level check.

---

### Testing Summary

| Test Type               | Tool                       | Speed                | What It Validates                                           |
| ----------------------- | -------------------------- | -------------------- | ----------------------------------------------------------- |
| **Unit**                | Vitest                     | ⚡ Instant (~ms)     | Pure game math — XP formulas, streak logic, stamina math    |
| **Repository**          | Vitest + in-memory MongoDB | 🚀 Fast (~seconds)   | DB reads/writes, document mapping, null handling            |
| **Service Integration** | Vitest + in-memory MongoDB | 🏃 Medium (~seconds) | Full use-case: input → business logic → DB → correct output |
| **E2E**                 | Playwright                 | 🐢 Slow (~minutes)   | Full browser flow against a live running app                |

### What's NOT Covered Yet (Gaps)

- API route tests cover workouts, runs, exercises, templates, quest claim and the outbox cron sweep; the other routes rely on the service integration tests, and `route-table.test.ts` guards that every route is built with `defineRoute`

To run all tests:

```bash
npm test
# or for interactive UI:
npx vitest --ui
```
