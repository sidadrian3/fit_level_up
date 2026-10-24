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
[ Service Layer ] (src/lib/services)
   │ - Orchestration & Transaction Start
   │ - Fetch User State from DB
   │
   ├─► (3) evaluateWorkout(input, user.stamina) 
   │   [ Domain Layer ] (src/lib/domain)
   │   - Pure Math (XP, Stamina Cost)
   │   ◄─ Returns { xpEarned, cost }
   │
   ├─► (4) Insert Workout & Update User
   │   [ Data Layer ] (src/lib/data)
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
**Location:** `src/lib/services/...`

The Service layer acts as the orchestrator. It manages the database transaction, stitches together domain logic, and triggers side effects. If something needs to happen in a specific order (like saving a workout, then updating a quest, then updating the user's XP), it happens here.

**Example Snippet (`src/lib/services/workouts/log-workout.ts`):**
```typescript
export async function logWorkout(input: CreateWorkoutInput, userId: string): Promise<Workout> {
    const client = await clientPromise;
    const session = client.startSession();
    
    // Execute inside a single ACID transaction
    const workoutObj = await session.withTransaction(async () => {
        const user = await UserStateService.getUser(userId, session);
        
        // Ask Domain Layer to do the math
        const evaluation = evaluateWorkout(input, user.stamina);
        
        // Persist to Data Layer
        const workout = await insertWorkout({ ...input, xpEarned: evaluation.finalXpEarned }, session);

        // Written in this transaction; delivered after the response by `defineRoute`
        await emit("activity.logged", { userId, activity: { type: "workout", id: workout.id }, occurredAt: now }, { session });

        // Orchestrate Side-Effects
        await updateQuestProgress(userId, { type: "workout_created" }, { now, timeZone: user.timeZone }, session);
        await UserStateService.applyActivity(userId, { /* XP and Stamina updates */ }, session);

        return workout;
    });

    return workoutObj;
}
```

### 3. Domain (Business Rules Layer)
**Location:** `src/lib/domain/...`

The Domain layer is where the "game mechanics" live. It contains pure, synchronous functions that take inputs and calculate outputs. Because this layer has **no side effects** and doesn't touch the database, it is extremely fast and easy to write unit tests for.

Domain rules never read the clock or assume a time zone. Every calendar-day rule (`calcNewStreak`, `calcDisplayStreak`, `calcActiveDays`, `getPeriodForCategory`) takes `now: Date` and the user's `timeZone` as arguments, and the service supplies both. The calendar helpers (`toLocalDay`, `addDays`, `startOfWeek`, `startOfLocalDay`) live in `src/shared/time/calendar.ts`; weeks run Monday to Sunday.

When a rule is violated (an incomplete quest claim, a friend request to yourself, an empty workout title) it throws a `DomainError` from `src/server/platform/domain/domain-error.ts`. Its `kind` is `invalid` or `conflict`, and `toErrorResponse` maps those to `400` and `409`. The domain layer defines this error itself because it may not import from the HTTP platform area.

**Example Snippet (`src/lib/domain/workout-evaluator.ts`):**
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
**Location:** `src/lib/data/...`

The Data layer is the only place that talks directly to MongoDB. Two helpers keep Mongo's raw failure modes out of the other layers: `parseObjectId` (`src/server/platform/database/mongo-utils.ts`) turns a malformed id into `null`, so a lookup becomes a 404 instead of a crash, and `isDuplicateKeyError` (same file) recognizes a unique-index violation, so a service can turn it into a `ConflictError` or, for the create routes, let `createOnce` replay the existing row. It is responsible for raw insertion, fetching, and ensuring the documents returned strictly match the TypeScript interfaces defined in `src/lib/types.ts`.

**Example Snippet (`src/lib/data/workout-db.ts`):**
```typescript
export async function insertWorkout(
    input: Omit<Workout, "id"> & { idempotencyKey: string; idempotencyFingerprint: string },
    session?: ClientSession
): Promise<Workout> {
    const workouts = await getCollection<WorkoutDocument>("workouts");
    
    const result = await workouts.insertOne({
        ...input,
        _id: new ObjectId(),
    }, { session });

    return {
        id: result.insertedId.toString(),
        title: input.title,
        // ... map other fields
    };
}
```

---

## 🧠 Why Build It This Way?

1. **Testability**: You can test the "Game Math" (Domain) without mocking a database. You can test the database without knowing about HTTP.
2. **Safety**: Complex operations like logging a run update 3-4 different database collections. By orchestrating them in the **Service Layer** with a `session.withTransaction()`, if one fails, they all roll back safely.
3. **Speed and durability**: Side effects like `evaluateAchievements` and the friend level-up notice are decoupled from the API response. The service `emit()`s an event into the `outbox` collection inside its transaction, and `defineRoute` delivers it with Next.js `after()` once the response is sent, so the user gets a snappy UI. If the function dies first, the row is still there and the daily `/api/cron/outbox-sweep` delivers it.
