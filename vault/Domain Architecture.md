# Domain Architecture

This document maps out how features in Fit Level Up work from layer to layer. By strictly separating concerns into four distinct layers, the codebase remains highly testable, predictable, and easy to navigate.

## 🏗️ Layered Architecture Flow

The following diagram illustrates how a typical action (like logging a workout) flows through the system:

```text
[ Client ]
   │
   │ (1) POST /api/workouts { title, duration... }
   ▼
[ API Layer ] (src/app/api)
   │ - defineRoute: Auth, Rate Limiting, Validation (Zod), Error mapping
   │
   │ (2) logWorkout(parsedInput, userId)
   ▼
[ Service Layer ] (src/server/training/workouts)
   │ - Orchestration & Transaction Start
   │ - Fetch User State from DB
   │
   ├─► (3) evaluateWorkout(input, user.stamina) 
   │   [ Domain Layer ] (workout.rules.ts)
   │   - Pure Math (XP, Stamina Cost)
   │   ◄─ Returns { xpEarned, cost }
   │
   ├─► (4) Insert Workout & Update User
   │   [ Data Layer ] (workout.repository.ts)
   │   - ACID Transaction Execution
   │   ◄─ Success
   │
   │ - (5) Trigger Background Events (Achievements via next/after)
   │
   ▼
[ API Layer ] 
   │
   │ (6) Return 201 Created (Logged Workout)
   ▼
[ Client ]
```

---

## 🧩 Feature Modules

The back end is organised by feature, not by layer. Three modules own their whole slice, and each exposes one `index.ts` that other code must import through (ESLint enforces it):

| Module | Owns |
|---|---|
| `src/server/progression` | XP, level, streak, stamina and totals on the player profile |
| `src/server/quests` | Quest definitions (`QUEST_DEFINITIONS`), period rules, sync, progress and claim |
| `src/server/training` | Workouts, runs, templates, custom exercises and stats (personal records, dashboard), one folder and one `<noun>.service.ts` per sub-feature |
| `src/server/achievements` | Evaluates unlock conditions when `activity.logged` or `progression.leveled-up` is delivered, writes unlocks, emits `achievement.unlocked`; lists achievements. Imported only by `runtime.ts` and `src/app` |
| `src/server/social` | Friendships: a `FRIENDSHIP_TRANSITIONS` table, batched friend and request lists, lazy personal records, the decline cooldown, and the `friendship.*` events |
| `src/server/notification` | Listener-only: turns events into `notifications` rows and serves the inbox and mark-read; imported only by `runtime.ts` and `src/app` |

Inside a module every file is `index.ts` or `<noun>.<role>.ts`, with role `service`, `repository`, `rules`, `definitions`, `events`, `listeners` or `adapters`. `index.ts` is the public surface. Routes and `<noun>.listeners.ts` files are the controllers: they call services, may wire one module's function into another, and hold no business rules. [[Server File Layout Plan]] records why.

The remaining feature (users) still uses the `src/lib/services`, `src/lib/domain` and `src/lib/data` folders until it is moved.

Inside a module the four layers keep the same names: use cases are plain functions, `*.rules.ts` files are pure, and `*.repository.ts` files are the only code that touches a collection, built on `userScopedRepository` so every query is filtered by `userId`. Modules call each other directly inside the caller's transaction when the result must commit together (training → quests → progression), and through events otherwise.

---

## 🔍 The Four Layers in Detail

### 1. Endpoints (API Layer)
**Location:** `src/app/api/...`

The API layer is extremely thin. A route file declares its contract to `defineRoute` (`src/server/platform/http`, wired in `src/server/runtime.ts`), which authenticates the user, enforces the rate limit, parses params, query and body with Zod, and turns any thrown error into a JSON response. The handler receives the parsed values and calls a service. **It never performs business logic or talks directly to the database, and it contains no `try/catch`.**

**Example Snippet (`src/app/api/workouts/route.ts`):**
```typescript
export const POST = defineRoute(
  { name: "workouts.create", auth: "user", throttle: "standard", body: CreateWorkoutSchema, status: 201 },
  ({ userId, body }) => logWorkout(body, userId)
);
```

### 2. Services (Application Layer)
**Location:** `src/server/<module>/**/<noun>.service.ts` (or `src/lib/services/...` for features not yet moved)

The Service layer acts as the orchestrator. It manages the database transaction, stitches together domain logic, and triggers side effects. If something needs to happen in a specific order (like saving a workout, then updating a quest, then updating the user's XP), it happens here.

**Example Snippet (`src/server/training/workouts/workout.service.ts`):**
```typescript
export async function logWorkout(input: CreateWorkoutInput, userId: string): Promise<Workout> {
    const client = await clientPromise;
    const session = client.startSession();
    
    // Execute inside a single ACID transaction
    const workoutObj = await session.withTransaction(async () => {
        const player = await getPlayerState(userId, { now, session });
        const timeZone = await getUserTimeZone(userId, { session });
        
        // Ask Domain Layer to do the math
        const evaluation = evaluateWorkout(input, player.stamina);
        
        // Persist to Data Layer
        const workout = await insertWorkout({ ...input, xpEarned: evaluation.finalXpEarned }, session);

        // Written in this transaction; delivered after the response by `defineRoute`
        await emit("activity.logged", { userId, activity: { type: "workout", id: workout.id }, occurredAt: now }, { session });

        // Orchestrate Side-Effects
        await updateQuestProgress(userId, { type: "workout_created" }, { now, timeZone }, session);
        // One write for XP, streak, stamina and totals; emits progression.leveled-up on a level change
        await recordActivity({ userId, source: { type: "workout", id: workout.id }, xp: workout.xpEarned, staminaCost: evaluation.staminaCost, totals: { workouts: 1 }, occurredAt: now }, session);

        return workout;
    });

    return workoutObj;
}
```

### 3. Domain (Business Rules Layer)
**Location:** `src/server/<module>/**/*.rules.ts` (or `src/lib/domain/...` for features not yet moved)

The Domain layer is where the "game mechanics" live. It contains pure, synchronous functions that take inputs and calculate outputs. Because this layer has **no side effects** and doesn't touch the database, it is extremely fast and easy to write unit tests for.

Domain rules never read the clock or assume a time zone. Every calendar-day rule (`calcNewStreak`, `calcDisplayStreak`, `calcActiveDays`, `getPeriodForCategory`) takes `now: Date` and the user's `timeZone` as arguments, and the service supplies both. The calendar helpers (`toLocalDay`, `addDays`, `startOfWeek`, `startOfLocalDay`) live in `src/shared/time/calendar.ts`; weeks run Monday to Sunday.

When a rule is violated (an incomplete quest claim, a friend request to yourself, an empty workout title) it throws a `DomainError` from `src/server/platform/domain.ts`. Its `kind` is `invalid` or `conflict`, and `toErrorResponse` maps those to `400` and `409`. The domain layer defines this error itself because it may not import from the HTTP platform area.

**Example Snippet (`src/server/training/workouts/workout.rules.ts`):**
```typescript
export function evaluateWorkout(input: CreateWorkoutInput, currentStamina: number) {
    // Pure math based on GAME_CONFIG
    const baseDurationXp = input.duration * GAME_CONFIG.xp.workout.durationMultiplier;
    const baseExerciseXp = input.exercises.length * GAME_CONFIG.xp.workout.exerciseMultiplier;
    const baseXp = baseDurationXp + baseExerciseXp;

    const staminaCost = calcStaminaCost(input.duration);
    
    // Apply Exhaustion Debuff if stamina is too low
    const finalXpEarned = calcExhaustionDebuff(baseXp, currentStamina, staminaCost);

    return {
        staminaCost,
        baseXp,
        finalXpEarned,
        exercises: input.exercises
    };
}
```

### 4. Data (Persistence Layer)
**Location:** `src/server/<module>/**/*.repository.ts` (or `src/lib/data/...` for features not yet moved)

The Data layer is the only place that talks directly to MongoDB. Two helpers keep Mongo's raw failure modes out of the other layers: `parseObjectId` (`src/server/platform/database/mongo-utils.ts`) turns a malformed id into `null`, so a lookup becomes a 404 instead of a crash, and `isDuplicateKeyError` (same file) recognizes a unique-index violation, so a service can turn it into a `ConflictError` or, for the create routes, let `createOnce` replay the existing row. It is responsible for raw insertion, fetching, and ensuring the documents returned strictly match the TypeScript interfaces defined in `src/lib/types.ts`.

**Example Snippet (`src/server/training/workouts/workout.repository.ts`):**
```typescript
const workouts = userScopedRepository<WorkoutDoc & UserOwnedDoc>("workouts");

export async function insertWorkout(input: Omit<WorkoutDoc, "_id">, session?: ClientSession): Promise<Workout> {
    const { userId, ...rest } = input;
    return toWorkout(await workouts.insertOne(userId, rest, { session }));
}

export async function deleteWorkoutById(userId: string, id: string, session?: ClientSession): Promise<Workout | null> {
    const doc = await workouts.deleteById(userId, id, { session });
    return doc ? toWorkout(doc) : null;
}
```

---

## 🧠 Why Build It This Way?

1. **Testability**: You can test the "Game Math" (Domain) without mocking a database. You can test the database without knowing about HTTP.
2. **Safety**: Complex operations like logging a run update 3-4 different database collections. By orchestrating them in the **Service Layer** with a `session.withTransaction()`, if one fails, they all roll back safely.
3. **Speed and durability**: Side effects like `evaluateAchievements` and the friend level-up notice are decoupled from the API response. The service `emit()`s an event into the `outbox` collection inside its transaction, and `defineRoute` delivers it with Next.js `after()` once the response is sent, so the user gets a snappy UI. If the function dies first, the row is still there and the daily `/api/cron/outbox-sweep` delivers it.
