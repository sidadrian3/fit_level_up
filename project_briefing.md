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
- Maintain a daily activity streak (breaks if you skip a day)
- Complete daily, weekly, and special quests (e.g. "Do 3 workouts this week")
- Unlock achievement badges (e.g. "First Run", "Level 10", "30-day streak")
- View a dashboard with weekly stats and a heatmap of active days
- Manage a stamina system — overtraining costs more XP (exhaustion debuff)
- Create custom exercises and reuse them across sessions
- Fully authenticated accounts (email/password via Better Auth)
- **Add friends by User ID**, accept/decline incoming requests, and remove friends
- **View a friend's profile modal** — see their level, streak, total workouts, distance, and personal records (heaviest lifts, fastest 5K/10K, longest run)
- **Receive real-time notifications** via SSE — when a friend accepts a request or logs activity, a toast notification appears instantly without a page refresh

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
| **Services**   | `src/lib/services/` | Orchestrate everything. Call domain rules → call DB → trigger side effects.                         |
| **Domain**     | `src/lib/domain/`   | Pure functions. XP formulas, streak logic, stamina calculations. No database imports, ever.         |
| **Data**       | `src/lib/data/`     | Raw MongoDB access. Convert DB documents to TypeScript types. No business logic.                    |

### Frontend

- **React 19** with the Next.js App Router (server components where possible, client components for interactive UI)
- **TanStack Query v5** for all data fetching, caching, and mutation state
- **UserContext** wraps the currently logged-in user's data globally so any component can read it
- **Tailwind CSS v4** for styling

### Database

- **MongoDB 7** — either local (Docker) or cloud (Atlas)
- Uses a **Replica Set** even locally, because MongoDB multi-document transactions require one
- Mongoose is NOT used — the native MongoDB driver is used directly, with typed collection wrappers

### Local Development Setup

To run the app locally you need **two infrastructure services**:

| Service | How to Run | Required For |
| ------- | ---------- | ------------ |
| **MongoDB 7 (Replica Set)** | `docker compose up -d` | Everything — workouts, runs, quests, auth |
| **Upstash Redis (cloud)** | Set env vars in `.env.local` | SSE real-time friend notifications |

**Why can't Redis just be a local Docker container?**  
The SSE layer uses `@upstash/redis`, which speaks Upstash's **HTTP REST API** — not raw TCP Redis. A standard `redis:alpine` container is not compatible. You must point to a real Upstash endpoint. Free tier is sufficient for local dev.

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

> **Note:** If `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are missing, SSE events will silently fail (the publisher catches and logs the error). The rest of the app works fine without them.

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
├── components/            ← React UI components (workouts, runs, quests, dashboard, layout)
├── lib/
│   ├── config/            ← game-config.ts  (all balance constants)
│   ├── constants/         ← Other shared constants
│   ├── context/           ← UserContext (global current-user state)
│   ├── data/              ← *-db.ts files  (MongoDB access)
│   │   └── api-client/    ← Client-side fetch helpers for TanStack Query
│   ├── domain/            ← Pure business rules (*-rules.ts)
│   ├── hooks/             ← Custom React hooks
│   ├── services/          ← Use-case services (one folder per domain)
│   ├── utils/             ← Utility helpers (formatters, date math)
│   ├── validations/       ← Zod schemas (API input validation)
│   ├── auth/              ← Better Auth config and helpers
│   ├── types.ts           ← Shared TypeScript domain types
│   └── mongodb.ts         ← Singleton MongoDB client
├── scripts/               ← DB seed / migration scripts
├── env.ts                 ← Type-safe environment variable validation
└── proxy.ts               ← Next.js edge middleware (route protection)
```

### What Happens When You Log a Workout (The Full Flow)

This is the most important sequence to understand. Every workout log triggers a 6-step transaction:

```
POST /api/workouts
  1. getAuthUserId()          ← verify session
  2. Zod schema validation    ← sanitize input

  → logWorkout() service
      3. Domain validation (pure): is the input valid?
      4. Domain calculation (pure): how much XP, what stamina cost?

      ─── MongoDB Transaction (all-or-nothing) ──────────────────────
      5. getUserFromDb()           ← read stamina + last activity
      6. insertWorkout()           ← save the workout
      7. updateQuestProgress()     ← update quest counters
      8. grantUserXP()             ← add XP + level up if threshold crossed
      9. updateUserStatsInDb()     ← increment totalWorkouts counter
     10. updateUserStreakOnActivity() ← recalculate streak
     11. evaluateAchievements()    ← check if any badges unlock
     12. updateUserStaminaInDb()   ← drain stamina
      ───────────────────────────────────────────────────────────────
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
- Full CRUD for workouts and runs (create, list with pagination, edit, delete)
- Profile page with personal records
- **Friend System (fully implemented):**
  - Send/accept/decline friend requests by User ID
  - Remove friends
  - Friend cards show level, streak, and link to a detailed profile modal
  - Friend profile modal: avatar, name, level, streak, total workouts, total distance, and full personal records (top lifts, fastest 5K/10K, longest run)
  - Personal records calculated on-the-fly from all workouts and runs at query time
  - Real-time SSE layer: friend events (accepted requests, friend activity) pushed to connected browsers
  - Automatic reconnection on SSE drop with exponential backoff

**Infrastructure:**

- Strict 4-layer architecture (domain/service/data separation fully enforced)
- MongoDB transactions wrapping all multi-step writes (`logWorkout`, `logRun`, `claimQuestReward`)
- Idempotency keys on workout and run creation (prevents duplicate submissions on network retry)
- Proper MongoDB indexes on all hot-path queries (including a unique compound index on `(requesterId, receiverId)` for friendships)
- Zod validation on every API endpoint
- Type-safe environment variables (validated at startup — server won't start with missing env vars)
- Unit tests (Vitest + in-memory MongoDB) covering domain rules, data layer, service layer, and SSE registry
- Service layer uses `targetUserId` (the other person's ID) — no internal document IDs exposed to frontend

**Code quality improvements already applied (from the P0/P2 audit fixes):**

- Game balance constants extracted from magic numbers into `game-config.ts` (was P2 item #10)
- `UserContext` now uses TanStack Query (`invalidateQueries`) instead of the `window` event bus anti-pattern (was P2 item #11)
- `UserMongoDoc` fields made non-optional where game data is always present
- Dead batch fetch in `updateQuestProgress` removed
- XP race condition in `grantUserXP` fixed (read moved inside the session)
- Auth errors now return proper `401` status codes instead of being swallowed as `400`

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
| 16  | **Quest template caching** | Right now, every quest read hits MongoDB to fetch all active templates. Templates almost never change. A 60-second in-memory cache (or `React.cache`) would cut this to near-zero DB reads. |

| 19 | **Centralized error handling** | Every API route has its own `try/catch` with slightly different error handling. A `withAuth(handler)` wrapper would standardize all of this. |

---

### Track B — Friend System (Real-Time Updates Showcase) ✅ COMPLETED

This feature has been fully implemented. It serves two purposes:

1. **Product value:** Users can add friends, see their stats, and compete socially — a huge motivation multiplier for fitness apps.
2. **Technical showcase:** Demonstrates **real-time updates** using Server-Sent Events (SSE). When your friend accepts a request, you see a toast notification live without refreshing.

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
| `GET`    | `/api/friends`              | List your accepted friends with full profile + records |
| `GET`    | `/api/friends/requests`     | List pending incoming requests with requester profile  |
| `DELETE` | `/api/friends/[id]`         | Remove a friend (using target's User ID)               |
| `GET`    | `/api/friends/events`       | SSE stream — pushes live events to the browser         |

> **Important design decision:** All friendship mutation endpoints accept the **other user's `userId`** (not an opaque MongoDB `_id`). The backend internally resolves the correct `Friendship` document using `getFriendshipBetweenFromDb(currentUserId, targetUserId)`. This was a deliberate refactor to fix a bug where the frontend was passing the wrong ID type.

#### Real-Time Layer (SSE)

- `src/lib/sse/sse-publisher.ts` — the Redis queue publisher. Uses Upstash Redis `RPUSH` to send events to per-user message queues (`"sse:{userId}"`) with a 60-second auto-expiry. Allows any serverless container to push an event to any connected user by ID, fixing the Vercel container isolation problem.
- `src/lib/hooks/useFriendEvents.ts` — client-side hook. Opens a persistent `EventSource` connection to `/api/friends/events`, listens for named events, and calls `queryClient.invalidateQueries()` on arrival so TanStack Query auto-refreshes the UI.
- Events pushed: `friend_request`, `friend_accepted`, `friend_level_up`.
- Auto-reconnects on drop (standard `EventSource` browser behaviour).
- The `/api/friends/events` route uses a 5-second polling loop (`LPOP`) to check Redis for messages and forward them to the browser. It sets `maxDuration = 60` for Vercel Hobby compatibility.

#### Friend Page UI

- Three tabs: **My Friends**, **Requests** (with unread badge count), **Add Friends**
- Add Friends tab uses User ID lookup (not username/email search) — shows a preview of the found user before sending
- `FriendCard` — clickable card that opens the profile modal on click
- `FriendProfileModal` — glassmorphic modal with: gradient cover, avatar, level/streak badges, total workouts/distance stats, and a full personal records list (strength, cardio, endurance icons)
- `FriendRequestCard` — shows requester's avatar, name, level with Accept/Decline actions
- Personal records calculated on-the-fly via `calculatePersonalRecords(workouts, runs)` in `get-friends.ts`

#### Business Rules (`src/lib/domain/friend-rules.ts`)

- Cannot send a request to yourself
- Cannot send a duplicate request (checked by existing friendship document)
- Only the receiver can accept or decline a request
- Either party can remove an accepted friendship
- Re-requesting after a decline creates a new document

---

## Quick Reference: Key Files to Know

| File                                                                                        | What It Does                                                                      |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [log-workout.ts](file:///z:/Projects/fit_level_up/src/lib/services/workouts/log-workout.ts) | The most important file. The full workout logging orchestration.                  |
| [user-rules.ts](file:///z:/Projects/fit_level_up/src/lib/domain/user-rules.ts)              | XP leveling, streak calculation — the core game math.                             |
| [game-config.ts](file:///z:/Projects/fit_level_up/src/lib/config/game-config.ts)            | Every balance constant. Change here to tune the game feel.                        |
| [user-db.ts](file:///z:/Projects/fit_level_up/src/lib/data/user-db.ts)                      | MongoDB reads/writes for the user document (XP, streak, stamina).                 |
| [types.ts](file:///z:/Projects/fit_level_up/src/lib/types.ts)                               | Every shared TypeScript type. The "language" of the whole app.                    |
| [UserContext.tsx](file:///z:/Projects/fit_level_up/src/lib/context/UserContext.tsx)         | Global React context for the logged-in user. Used everywhere.                     |
| [proxy.ts](file:///z:/Projects/fit_level_up/src/proxy.ts)                                   | Next.js middleware — redirects unauthenticated users to login.                    |
| [ensure-indexes.ts](file:///z:/Projects/fit_level_up/src/lib/data/ensure-indexes.ts)        | All MongoDB index definitions. Run at startup.                                    |
| [friendships-db.ts](file:///z:/Projects/fit_level_up/src/lib/data/friendships-db.ts)        | All MongoDB CRUD for the `friendships` collection.                                |
| [sse-publisher.ts](file:///z:/Projects/fit_level_up/src/lib/sse/sse-publisher.ts)             | Redis-backed publisher. Pushes SSE events to per-user queues for serverless compatibility. |
| [useFriendEvents.ts](file:///z:/Projects/fit_level_up/src/lib/hooks/useFriendEvents.ts)     | Client hook — opens SSE stream and invalidates TanStack Query cache on events.    |
| [friend-rules.ts](file:///z:/Projects/fit_level_up/src/lib/domain/friend-rules.ts)          | Pure domain rules: who can send/accept/remove friendships.                        |
| [records.ts](file:///z:/Projects/fit_level_up/src/lib/utils/records.ts)                     | `calculatePersonalRecords()` — computes top lifts and fastest runs from raw data. |

---

## Known Issues (Still Open)

| Priority | Issue                                                             | Status    |
| -------- | ----------------------------------------------------------------- | --------- |
| 🟢 P3    | Quest template caching                                            | In plan   |
| 🟢 P3    | Centralized error handler wrapper                                 | In plan   |
| ✅ Done  | Friend System + Real-Time SSE                                     | Completed |
| 🟢 P3    | log-workout-test, stamina and lastStaminaUpdate update test mocks | In plan   |

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

**File locations:** `src/lib/domain/__tests__/`  
**What they test:** The pure game math functions — XP calculation, level-up logic, streak counting, stamina math.  
**Why they're fast:** Zero database. Zero network. Just JavaScript functions in, values out.

#### Example: Testing the Level-Up Formula

```typescript
// src/lib/domain/__tests__/user-rules.test.ts

describe("calcLevelUp", () => {
  // TEST 1: Simple case — earn some XP but not enough to level up
  it("should correctly add XP without leveling up", () => {
    //         currentXp, level, xpToNextLevel, addedXp
    const result = calcLevelUp(100, 1, 500, 50);
    //                                   ↑              ↑
    //                           at Level 1       add 50 XP

    expect(result).toEqual({
      newXp: 150, // 100 + 50 = 150
      newLevel: 1, // didn't cross the 500 threshold — still Level 1
      newXpToNextLevel: 500, // threshold unchanged
      levelUp: false, // no level up happened
    });
  });

  // TEST 2: XP crosses the threshold — level up should occur
  it("should level up when XP exceeds threshold", () => {
    //         currentXp, level, xpToNextLevel, addedXp
    const result = calcLevelUp(450, 1, 500, 100);
    //                          ↑                           ↑
    //                   already at 450/500          earn 100 more

    expect(result).toEqual({
      newXp: 50, // 450 + 100 = 550, crossed 500 → 550 - 500 = 50 remaining
      newLevel: 2, // leveled up to 2
      newXpToNextLevel: 1000, // Level 2 costs 2 × 500 = 1000
      levelUp: true,
    });
  });

  // TEST 3: Edge case — massive XP dump causes multiple level-ups at once
  it("should handle multiple level ups at once", () => {
    // Start: Level 1 with 450 XP (needs 50 more to level up)
    // Add 2000 XP
    // Level 1: 450 + 2000 = 2450 → cross 500 → 1950 left (Level 2, need 1000)
    // Level 2: 1950 → cross 1000 → 950 left (Level 3, need 1500)
    // Level 3: 950 < 1500 → stop
    const result = calcLevelUp(450, 1, 500, 2000);

    expect(result).toEqual({
      newXp: 950,
      newLevel: 3,
      newXpToNextLevel: 1500,
      levelUp: true,
    });
  });
});
```

**What this proves:** The leveling formula handles normal XP gain, exact-threshold crossing, and multi-level jumps in one earning event — all without touching a database.

---

#### Example: Testing Streak Logic

```typescript
// src/lib/domain/__tests__/user-rules.test.ts

describe("calcNewStreak", () => {
  // Case 1: Brand new user logging their first ever activity
  it("should start a streak at 1 if no previous activity", () => {
    expect(calcNewStreak(undefined, undefined, "2024-01-01")).toBe(1);
    //                   ↑ no streak    ↑ no last date
    // → streak starts fresh at 1
  });

  // Case 2: User logs twice on the same day — streak shouldn't double count
  it("should keep streak the same if logging multiple times on the same day", () => {
    expect(calcNewStreak(5, "2024-01-01", "2024-01-01")).toBe(5);
    //                    ↑ same date as today
    // → streak stays at 5, not 6
  });

  // Case 3: User logs on back-to-back days — extend the streak
  it("should extend streak if logging on the consecutive day", () => {
    expect(calcNewStreak(5, "2024-01-01", "2024-01-02")).toBe(6);
    //                      ↑ yesterday     ↑ today
    // → 5 + 1 = 6
  });

  // Case 4: User skipped a day — streak resets back to 1
  it("should reset streak to 1 if there is a gap day", () => {
    expect(calcNewStreak(5, "2024-01-01", "2024-01-03")).toBe(1);
    //                      ↑ two days ago — the gap breaks it
    // → 5 resets to 1
  });

  // Case 5: MongoDB stores dates as Date objects — must handle both types
  it("should handle Date objects properly", () => {
    expect(
      calcNewStreak(5, new Date("2024-01-01T12:00:00Z"), "2024-01-02"),
    ).toBe(6);
    //                      ↑ a real Date object from the DB
  });
});
```

**What this proves:** The streak logic correctly handles all the tricky edge cases — same day, consecutive day, gap, and the MongoDB `Date` vs `string` type ambiguity.

---

#### Example: Testing the Stamina System

```typescript
// src/lib/domain/__tests__/stamina-rules.test.ts

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

**File locations:** `src/lib/data/__tests__/`  
**What they test:** The raw MongoDB functions — do they correctly write to the DB, read back out, and map the document shape correctly?  
**Infrastructure:** Uses the same in-memory MongoDB from the global setup.

```typescript
// src/lib/data/__tests__/custom-exercises-db.test.ts

describe("custom-exercises-db Data Layer Test", () => {
  const userId = "db-user-id";

  // Clean out any leftover test data before and after
  beforeAll(async () => {
    const col = await getCollection("customExercisesCollection");
    await col.deleteMany({ userId });
  });
  afterAll(async () => {
    const col = await getCollection("customExercisesCollection");
    await col.deleteMany({ userId });
  });

  // TEST: Does insertOne give back a real MongoDB _id?
  it("should create an exercise and assign an _id", async () => {
    const doc = await createCustomExerciseFromDb({
      userId,
      name: "DB Test Exercise",
      targetMuscle: TargetMuscle.Core,
    });

    expect(doc._id).toBeDefined(); // MongoDB should have assigned an ObjectId
    expect(doc.userId).toBe(userId);
  });

  // TEST: Does the toExercise() mapper work correctly?
  // MongoDB stores _id (ObjectId), but the app uses id (string).
  // This test verifies the conversion happens AND the internal _id is hidden.
  it("getAllCustomExercisesFromDb should map _id to id correctly", async () => {
    const exercises = await getAllCustomExercisesFromDb(userId);

    expect(exercises.length).toBe(1);
    expect(exercises[0].id).toBeDefined(); // ← public id field ✅
    // @ts-expect-error: intentionally checking runtime field doesn't exist
    expect(exercises[0]._id).toBeUndefined(); // ← MongoDB _id must be hidden ✅
  });

  // TEST: Can we look up a specific document by name + muscle group?
  it("should find a single document, and return null when not found", async () => {
    const found = await getCustomExerciseByNameFromDb(
      userId,
      "DB Test Exercise",
      TargetMuscle.Core,
    );
    expect(found).toBeDefined();
    expect(found?.name).toBe("DB Test Exercise");

    const missing = await getCustomExerciseByNameFromDb(
      userId,
      "Non Existent",
      TargetMuscle.Core,
    );
    expect(missing).toBeNull(); // Must return null, not throw
  });
});
```

**What this proves:** The data layer correctly handles the MongoDB `_id` → `id` conversion, and the not-found case returns `null` gracefully instead of throwing.

---

### Level 3 — Service Integration Tests (The Most Important Layer)

**File locations:** `src/lib/services/__tests__/`  
**What they test:** The entire use-case from end to end — input goes in, business logic runs, database is written to, and the result is correct. This tests multiple layers working together.

#### Example 1: The Complete Workout Logging Flow

```typescript
// src/lib/services/__tests__/log-workout.test.ts

describe('logWorkout Integration Test', () => {
  let userId: string;

  // Before ALL tests: create a real user in the test DB
  beforeAll(async () => {
    const usersCol = await getCollection<UserMongoDoc>("usersCollection");
    const result = await usersCol.insertOne({
      email: "test@example.com",
      name: "Test User",
      level: 1, xp: 0, xpToNextLevel: 500,
      streak: 0, totalWorkouts: 0, totalDistance: 0,
      createdAt: new Date(),
      // stamina not set here — tests control this per-test
    });
    userId = result.insertedId.toString();

    // Also create the indexes (specifically the unique idempotency index)
    await ensureIndexes();
  });

  // After EACH test: wipe workouts so tests don't bleed into each other
  afterEach(async () => {
    const workoutsCol = await getCollection("workoutsCollection");
    await workoutsCol.deleteMany({});
  });

  // ─── TEST 1: The happy path ───────────────────────────────────────────
  it('should log a workout, calculate XP, and update user stats', async () => {
    const workout = await logWorkout({
      title: "Morning Lift",
      duration: 60,
      exercises: [
        { name: "Bench Press", targetMuscle: TargetMuscle.Chest, sets: 3, reps: 10, weight: 135 },
        { name: "Squats",      targetMuscle: TargetMuscle.Legs,  sets: 3, reps: 10, weight: 225 }
      ]
    }, userId);

    // The returned workout object should be correct
    expect(workout.id).toBeDefined();
    expect(workout.title).toBe("Morning Lift");
    expect(workout.xpEarned).toBeGreaterThan(0);

    // The user's stats in MongoDB should reflect the workout
    const user = await usersCol.findOne({ _id: new ObjectId(userId) });
    expect(user!.totalWorkouts).toBe(1);       // incremented by 1 ✅
    expect(user!.xp).toBe(workout.xpEarned);   // XP granted ✅
    expect(user!.streak).toBe(1);              // streak started ✅
  });
```

**What this proves:** A full round-trip — the `logWorkout` service calls domain logic, writes to 3+ collections, and the user's stats are updated correctly in one atomic operation.

---

#### Example 2: Idempotency — Protecting Against Duplicate Submissions

```typescript
// ─── TEST 2: The "retry safety" test ─────────────────────────────────
it("should enforce idempotency and reject duplicate requests", async () => {
  // Simulate a client that generates a UUID for this specific workout
  const idempotencyKey = crypto.randomUUID();

  const workoutInput = {
    title: "Evening Run",
    duration: 30,
    exercises: [
      {
        name: "Jogging",
        targetMuscle: TargetMuscle.Cardio,
        sets: 1,
        reps: 1,
        weight: null,
      },
    ],
    idempotencyKey, // ← send the same key twice
  };

  // First request — succeeds
  const firstWorkout = await logWorkout(workoutInput, userId);
  expect(firstWorkout.id).toBeDefined();

  // Capture XP after first request
  const userAfterFirst = await usersCol.findOne({ _id: new ObjectId(userId) });
  const xpAfterFirst = userAfterFirst!.xp;

  // Second request with SAME idempotencyKey — must fail gracefully
  await expect(logWorkout(workoutInput, userId)).rejects.toThrow(
    "This workout was already logged.",
  );
  //               ↑ our specific error message, not a generic MongoDB crash

  // User's XP must NOT have changed (no double-credit)
  const userAfterSecond = await usersCol.findOne({ _id: new ObjectId(userId) });
  expect(userAfterSecond!.xp).toBe(xpAfterFirst); // ← same XP as after first request ✅

  // Only ONE workout should exist in the DB with this key
  const workoutsCol = await getCollection("workoutsCollection");
  const count = await workoutsCol.countDocuments({ userId, idempotencyKey });
  expect(count).toBe(1); // ← not 2 ✅
});
```

**What this proves:** A user on a flaky network connection who retries the same request twice cannot accidentally earn XP twice. The MongoDB unique index on `idempotencyKey` blocks the duplicate insert, and the service catches it and surfaces a clean error message.

---

#### Example 3: Stamina Recovery Before a Workout

```typescript
// ─── TEST 3: Lazy stamina recovery ───────────────────────────────────
it("should process lazy recovery before applying cost", async () => {
  // Arrange: user has 10 stamina, but it was updated 2 days ago
  const twoDaysAgo = new Date();
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

  await usersCol.updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: { stamina: 10, lastStaminaUpdate: twoDaysAgo.toISOString() },
    },
  );

  // Act: log a 60-minute workout (cost = 15 + 30 = 45)
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
  );

  // Assert:
  // Recovery:  10 stamina + (2 days × 50/day) = 110 → capped at 100
  // Cost:      100 - 45 = 55
  // Final:     55
  const userAfter = await usersCol.findOne({ _id: new ObjectId(userId) });
  expect(userAfter!.stamina).toBe(55); // ✅
});
```

**What this proves:** The lazy recovery runs correctly _before_ the stamina cost is applied, meaning a user who hasn't logged in 2 days gets their stamina back before it's drained.

---

#### Example 4: Business Rule Enforcement (No Duplicate Exercises)

```typescript
// src/lib/services/__tests__/create-custom-exercise.test.ts

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
  const col = await getCollection("customExercisesCollection");
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
| **Data Layer**          | Vitest + in-memory MongoDB | 🚀 Fast (~seconds)   | DB reads/writes, document mapping, null handling            |
| **Service Integration** | Vitest + in-memory MongoDB | 🏃 Medium (~seconds) | Full use-case: input → business logic → DB → correct output |
| **E2E**                 | Playwright                 | 🐢 Slow (~minutes)   | Full browser flow against a live running app                |

### What's NOT Covered Yet (Gaps)

- No tests for the `grantUserXP` race condition scenario
- No tests for `syncUserQuests` period-boundary logic
- No API route-level tests (would need to mock `getAuthUserId` or use an E2E approach)
- Quest progress update tests are missing (the dead-code bug in `updateQuestProgress` would have been caught by these)

To run all tests:

```bash
npm test
# or for interactive UI:
npx vitest --ui
```
