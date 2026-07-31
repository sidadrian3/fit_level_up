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
   │ - Auth, Rate Limiting & Validation (Zod)
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

The API layer is extremely thin. Its only job is to handle the HTTP context: parsing the request, authenticating the user, enforcing rate limits, and validating the JSON payload using Zod. **It never performs business logic or talks directly to the database.**

**Example Snippet (`src/app/api/workouts/route.ts`):**
```typescript
export async function POST(request: Request) {
    try {
        const userId = await getAuthUserId();
        
        // 1. Rate Limiting
        const { success } = await RateLimit.limit(userId);
        if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

        // 2. Validation
        const body = await request.json();
        const parsed = CreateWorkoutSchema.parse(body);
        
        // 3. Delegate to Service Layer
        const workout = await logWorkout(parsed, userId);
        
        return NextResponse.json(workout, { status: 201 });
    } catch (err) {
        return handleApiError(err);
    }
}
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

        // Orchestrate Side-Effects
        await updateQuestProgress(userId, { type: "workout_created" }, session);
        await UserStateService.applyActivity(userId, { /* XP and Stamina updates */ }, session);

        return workout;
    });

    // Asynchronous background task (does not block API response)
    after(evaluateAchievements(userId));

    return workoutObj;
}
```

### 3. Domain (Business Rules Layer)
**Location:** `src/lib/domain/...`

The Domain layer is where the "game mechanics" live. It contains pure, synchronous functions that take inputs and calculate outputs. Because this layer has **no side effects** and doesn't touch the database, it is extremely fast and easy to write unit tests for.

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

The Data layer is the only place that talks directly to MongoDB. It is responsible for raw insertion, fetching, and ensuring the documents returned strictly match the TypeScript interfaces defined in `src/lib/types.ts`.

**Example Snippet (`src/lib/data/workout-db.ts`):**
```typescript
export async function insertWorkout(
    input: Omit<Workout, "id"> & { idempotencyKey: string },
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
3. **Speed**: Heavy checks like `evaluateAchievements` are decoupled from the API response using Next.js `after()`, so the user gets a snappy UI experience while the server processes the badges in the background.
