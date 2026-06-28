# FitLevelUp — Principal-Level Architecture Review

---

## 1. High-Level Architectural Assessment

### What You Did Right

You're ahead of most junior/mid-level developers. Genuinely.

- **Clean type definitions.** [types.ts](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/types.ts) is well-structured. `DateString` type alias, `CreateWorkoutInput` vs `Workout`, `readonly` arrays in repository returns — this is real domain modelling.
- **Repository pattern exists.** The [repositories/](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/repositories) layer that wraps `fetch` calls for client components shows deliberate intent to separate transport from usage.
- **Pure utility functions.** [formatters.ts](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/utils/formatters.ts) and [calculations.ts](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/utils/calculations.ts) are textbook — zero side effects, zero imports from infrastructure, trivially testable. This is senior-level instinct.
- **Auth middleware.** [proxy.ts](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/proxy.ts) handles route protection at the edge. Good.
- **MongoDB connection singleton.** [mongodb.ts](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/mongodb.ts) handles hot-reload correctly with the global trick.

### The Biggest Overarching Structural Flaw

**Your `-db.ts` files are God Modules.** They are the single biggest architectural liability in this codebase.

Each file — [workout-db.ts](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/workout-db.ts), [runs-db.ts](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/runs-db.ts), [quests-db.ts](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/quests-db.ts) — is simultaneously responsible for:

1. **Configuration** (reading `process.env`)
2. **Validation** (input checking)
3. **Domain logic** (XP calculation, pace calculation, streak calculation)
4. **Persistence** (MongoDB CRUD operations)
5. **Orchestration** (calling quest progress, XP grants, achievement evaluation as side effects)
6. **Data mapping** (Mongo doc → domain type)

This means your **business rules are imprisoned inside your database layer**. You cannot test XP calculation without a running MongoDB. You cannot reuse quest-progress logic without importing half your infrastructure. A change to your database schema forces you to touch business logic files. This is the definition of a Clean Architecture violation.

---

## 2. The Code Smells (Violations)

### 🔴 SOLID Violations

#### Single Responsibility Principle (SRP)

| File | Violation | Why It's a Problem |
|---|---|---|
| [workout-db.ts:76-116](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/workout-db.ts#L76-L116) | `addWorkoutToDb` does CRUD **AND** orchestrates quest progress, XP grants, stat updates, achievement evaluation | One function has **5 reasons to change**: workout schema changes, XP formula changes, quest logic changes, stat tracking changes, achievement logic changes |
| [runs-db.ts:87-128](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/runs-db.ts#L87-L128) | `addRunToDb` has the exact same God Function pattern | Identical duplication of the orchestration concern |
| [stats-db.ts:42-118](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/stats-db.ts#L42-L118) | `getDashboardStatsFromDb` queries 4 different collections in one function | This is a reporting/analytics concern forced into a "stats" module that also reads user docs and achievement counts |
| [user-db.ts:52-83](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/user-db.ts#L52-L83) | `getUserFromDb` calculates streak **and** mutates the database as a side-effect of a read operation | A function named `getUser` should never have write side-effects. This violates Command-Query Separation (CQS) |

#### Dependency Inversion Principle (DIP)

| File | Violation | Why It's a Problem |
|---|---|---|
| [workout-db.ts:4-6](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/workout-db.ts#L4-L6) | `workout-db` directly imports `quests-db`, `user-db`, `achievements-db` | High-level orchestration policy depends on low-level concrete modules. There is no abstraction boundary — you can't swap achievement evaluation without touching the workout module |
| Every `-db.ts` file | All modules hardcode `clientPromise` import and `process.env` access | The database connection is a concrete dependency, not an injected one. No way to test against an in-memory database or mock |
| [achievements-db.ts:41-82](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/achievements-db.ts#L41-L82) | `INITIAL_ACHIEVEMENTS` seed data lives inside the database access module | Configuration/seed data is coupled to the persistence layer |

#### Open-Closed Principle (OCP)

| File | Violation | Why It's a Problem |
|---|---|---|
| [achievements-db.ts:161-174](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/achievements-db.ts#L161-L174) | `evaluateAchievements` uses a `switch` over `condition.metric` | Adding a new metric (e.g., `total_xp_earned`) requires modifying this switch. Should be a strategy pattern or a metric-to-getter map |
| [quests-db.ts:232-252](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/quests-db.ts#L232-L252) | `getQuestProgressUpdates` uses `if` to branch on `activity.type` | Same issue — new activity types require modifying existing code |

### 🟡 Functional Programming / React Violations

| File | Violation | Why It's a Problem |
|---|---|---|
| [dashboard/page.tsx](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/app/(app)/dashboard/page.tsx) (entire file) | `"use client"` on a page that does **zero** interactive work beyond mounting | This should be a Server Component that fetches data at request time. You're forcing the client to waterfall 4 separate API calls instead of a single server-side render |
| [profile/page.tsx](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/app/(app)/profile/page.tsx) (entire file) | Same — `"use client"` + 3 `useEffect` data fetches on mount | Same problem. No user interaction requires client-side rendering here. The profile page should be an `async` Server Component |
| [dashboard/page.tsx:100-108](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/app/(app)/dashboard/page.tsx#L100-L108) | `workoutTrendPercent` is computed inline in the render body with mutable `let` | This should be a pure function in `calculations.ts`. Derived state should never be computed inline with mutable variables |
| [Sidebar.tsx:43](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/components/layout/Sidebar.tsx#L43) | `xpPercent` is computed inline | You already have `calcXPPercent` in `calculations.ts` but don't use it. Duplication of logic |
| [api-fetch.ts:19-26](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/repositories/api-fetch.ts#L19-L26) | `apiFetchAndNotify` couples fetch with DOM side-effects (`window.dispatchEvent`) | This is an impure function masquerading as a utility. Side-effect coupling prevents testing and reuse in non-browser contexts (SSR) |

### 🟠 Clean Architecture Violations

| Issue | Where | What's Wrong |
|---|---|---|
| **Business logic in persistence layer** | `calcXpEarned` in [workout-db.ts:63-65](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/workout-db.ts#L63-L65), `calcXpEarned` in [runs-db.ts:63-72](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/runs-db.ts#L63-L72), `calcPace` in [runs-db.ts:74-76](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/runs-db.ts#L74-L76) | These are **domain rules**. They should live in a `domain/` or `services/` layer, not next to MongoDB operations. In an interview, this is the kind of thing that makes an architect say "they haven't separated concerns" |
| **Duplicated `getDbConfig()` pattern** | Every single `-db.ts` file | 6 copies of essentially the same function reading `process.env`. This is infrastructure concern that should be centralised |
| **No service/use-case layer** | `addWorkoutToDb` directly orchestrates 4 operations | In Clean Architecture, a "Log Workout" use case would call `workoutRepo.save()`, `xpService.grant()`, `questService.updateProgress()`, `achievementService.evaluate()` — each independently testable |
| **Date logic scattered everywhere** | `getWeekStartDate` in [stats-db.ts:18-25](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/stats-db.ts#L18-L25), `getMondayDateString` in [quests-db.ts:59-67](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/quests-db.ts#L59-L67) | Two different implementations of "get Monday". Both impure (depend on `new Date()`). Should be one function in `utils/`, taking a date parameter for testability |

### 🟤 Miscellaneous Code Smells

| File | Issue |
|---|---|
| [user-db.ts:59](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/user-db.ts#L59) | `console.log("getUserFromDb called with userId:", ...)` — debug logging left in production code |
| [user-db.ts:62](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/user-db.ts#L62) | More debug logging: `console.log("Could not find userDoc for _id:", ...)` |
| [runs-db.ts:57-59](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/runs-db.ts#L57-L59) | Commented-out validation code. Either implement it or delete it |
| [auth-helpers.ts:3](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/auth/auth-helpers.ts#L3) | `NextResponse` imported but never used |
| [stats-db.ts:107](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/lib/data/stats-db.ts#L107) | `process.env.MONGODB_USER_ACHIEVEMENTS_COLLECTION` read **inside** the function body instead of in `getDbConfig()`. Inconsistent with every other file's pattern |
| [PageHeader.tsx:28](file:///c:/Users/Sid/Documents/personal/Project_2/fit_level_up/src/components/layout/PageHeader.tsx#L28) | Using array index as React `key`. This is a React anti-pattern that can cause render bugs if the list reorders |

---

## 3. The Senior Refactor

The worst violation is the **God Function** pattern in `addWorkoutToDb` and `addRunToDb`. I'll refactor `addWorkoutToDb` to demonstrate the architectural correction.

### The Problem (Current)

```typescript
// workout-db.ts — ONE function does everything
export async function addWorkoutToDb(input, userId) {
  validateInput(input);                    // Validation
  const xp = calcXpEarned(...);            // Business logic
  await collection.insertOne(docToInsert); // Persistence
  await updateQuestProgressFromActivity(); // Side-effect orchestration
  await grantXP();                         // Side-effect orchestration
  await updateUserStats();                 // Side-effect orchestration
  await evaluateAchievements();            // Side-effect orchestration
}
```

### The Fix: Use-Case / Application Service Pattern

**Design Pattern**: Application Service (a.k.a. Use Case Interactor from Clean Architecture). The key principle: **the persistence layer only persists. The domain layer only calculates. The service layer orchestrates.**

#### Step 1 — Extract domain logic into a pure domain module

```typescript
// src/lib/domain/workout-rules.ts
// PURE FUNCTIONS — no imports from infrastructure, no database, no process.env

import type { CreateWorkoutInput, Exercise } from "@/lib/types";

export function validateWorkoutInput(input: CreateWorkoutInput): void {
  if (!input.title.trim()) {
    throw new Error("Title is required");
  }
  if (input.duration <= 0) {
    throw new Error("Duration must be greater than 0");
  }
  const namedExercises = input.exercises.filter((ex) => ex.name.trim());
  if (namedExercises.length === 0) {
    throw new Error("Add at least one exercise with a name");
  }
}

export function filterNamedExercises(exercises: Exercise[]): Exercise[] {
  return exercises.filter((ex) => ex.name.trim());
}

export function calcWorkoutXP(duration: number, exerciseCount: number): number {
  return Math.round(duration * 2 + exerciseCount * 15);
}
```

#### Step 2 — Make the DB module only responsible for persistence

```typescript
// src/lib/data/workout-db.ts
// ONLY database operations — no business logic, no side-effects

import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { Workout, Exercise } from "@/lib/types";

type WorkoutDoc = {
  _id?: ObjectId;
  userId: string;
  type: Workout["type"];
  title: string;
  exercises: Exercise[];
  duration: number;
  xpEarned: number;
  date: string;
};

function getDbConfig() {
  const dbName = process.env.MONGODB_DB;
  const collectionName = process.env.MONGODB_WORKOUTS_COLLECTION;
  if (!dbName) throw new Error("Missing MONGODB_DB");
  if (!collectionName) throw new Error("Missing MONGODB_WORKOUTS_COLLECTION");
  return { dbName, collectionName };
}

function toWorkout(doc: WorkoutDoc): Workout {
  if (!doc._id) throw new Error("Workout document is missing _id");
  return {
    id: doc._id.toString(),
    type: doc.type,
    title: doc.title,
    exercises: doc.exercises,
    duration: doc.duration,
    xpEarned: doc.xpEarned,
    date: doc.date,
  };
}

export async function getAllWorkouts(userId: string): Promise<Workout[]> {
  const { dbName, collectionName } = getDbConfig();
  const client = await clientPromise;
  const docs = await client
    .db(dbName)
    .collection<WorkoutDoc>(collectionName)
    .find({ userId })
    .sort({ _id: -1 })
    .toArray();
  return docs.map(toWorkout);
}

// ONLY inserts the document. Returns the created Workout. No side-effects.
export async function insertWorkout(
  doc: Omit<WorkoutDoc, "_id">
): Promise<Workout> {
  const { dbName, collectionName } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<WorkoutDoc>(collectionName);
  const result = await collection.insertOne(doc);
  return toWorkout({ _id: result.insertedId, ...doc });
}

// ... deleteWorkout, updateWorkout stay similar but WITHOUT side-effects
```

#### Step 3 — Create a Use Case that orchestrates

```typescript
// src/lib/services/log-workout.ts
// APPLICATION SERVICE — orchestrates domain logic + persistence + side effects

import type { CreateWorkoutInput, Workout } from "@/lib/types";
import {
  validateWorkoutInput,
  filterNamedExercises,
  calcWorkoutXP,
} from "@/lib/domain/workout-rules";
import { insertWorkout } from "@/lib/data/workout-db";
import { updateQuestProgressFromActivity } from "@/lib/data/quests-db";
import { grantXP, updateUserStats } from "@/lib/data/user-db";
import { evaluateAchievements } from "@/lib/data/achievements-db";

export async function logWorkout(
  input: CreateWorkoutInput,
  userId: string
): Promise<Workout> {
  // 1. Domain validation (pure)
  validateWorkoutInput(input);

  // 2. Domain calculation (pure)
  const exercises = filterNamedExercises(input.exercises);
  const xpEarned = calcWorkoutXP(input.duration, exercises.length);

  // 3. Persistence (single responsibility)
  const workout = await insertWorkout({
    userId,
    type: input.type,
    title: input.title.trim(),
    exercises,
    duration: input.duration,
    xpEarned,
    date: new Date().toISOString().slice(0, 10),
  });

  // 4. Side-effects (explicitly orchestrated, easy to extend or skip)
  await updateQuestProgressFromActivity(userId, {
    type: "workout_created",
    xpEarned: workout.xpEarned,
  });
  await grantXP(userId, workout.xpEarned);
  await updateUserStats(userId, { incrementWorkouts: 1 });
  await evaluateAchievements(userId);

  return workout;
}
```

#### Step 4 — The API route becomes a thin adapter

```typescript
// src/app/api/workouts/route.ts
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getAllWorkouts } from "@/lib/data/workout-db";
import { logWorkout } from "@/lib/services/log-workout";

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    const body = await request.json();
    const workout = await logWorkout(body, userId);
    return NextResponse.json(workout, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

### What This Gives You

| Before | After |
|---|---|
| Can't test XP formula without MongoDB | `calcWorkoutXP` is a pure function — test with `expect(calcWorkoutXP(30, 5)).toBe(135)` |
| Adding a new side-effect (e.g., push notification) means editing `workout-db.ts` | Add it to `log-workout.ts` — the persistence layer is untouched |
| Business logic is hidden inside 5 different `-db.ts` files | All domain rules live in `domain/` — discoverable, auditable |
| API routes import from the persistence layer | API routes import from the service layer — Clean Architecture dependency rule is satisfied |

> [!TIP]
> **Interview power move:** If an interviewer asks "how would you add email notifications when a user levels up?", you can answer: "I'd add a `notificationService.sendLevelUpEmail()` call in the `logWorkout` use case, right after `grantXP`. The persistence layer and domain rules don't change at all." That answer demonstrates mastery of the Open-Closed Principle.

---

## 4. The Interview Angle

Here's your interview question. Take 2 minutes to think about it before looking at the hint.

---

> **Question:** In your current `addWorkoutToDb` function, you execute 5 sequential async operations: `insertOne`, `updateQuestProgressFromActivity`, `grantXP`, `updateUserStats`, and `evaluateAchievements`. If `grantXP` succeeds but `updateUserStats` throws a network error:
>
> 1. What is the **observable state** of your system?
> 2. Is the user's data **consistent**?  
> 3. How would you fix this in a real production system?

---

<details>
<summary><strong>Hint (click to expand after thinking)</strong></summary>

The system is left in a **partially committed state**: the workout is persisted, the quest progress is updated, the user has received XP, but their `totalWorkouts` counter is wrong and achievements haven't been evaluated. This is a **saga consistency** problem.

Three approaches to discuss:

1. **MongoDB multi-document transactions** — wrap all 5 operations in `session.withTransaction()`. Simple but couples you to MongoDB and doesn't scale across services.
2. **Outbox pattern** — insert the workout + an "event" document in a single transaction. A background worker reads the event and executes the side-effects idempotently. This is the enterprise-grade answer.
3. **Eventual consistency with compensating actions** — accept that side-effects may fail, implement retry logic with idempotency keys, and run periodic reconciliation jobs. This is the pragmatic startup answer.

The *best* interview answer acknowledges all three and explains the tradeoff: **consistency guarantees vs. complexity vs. coupling**.

</details>

---

## Summary of Priority Actions

| Priority | Action | Effort |
|---|---|---|
| 🔴 P0 | Extract domain logic from `-db.ts` into `domain/` pure modules | Medium |
| 🔴 P0 | Create `services/` layer for use-case orchestration | Medium |
| 🟡 P1 | Convert Dashboard and Profile pages to Server Components | Low |
| 🟡 P1 | Fix `getUserFromDb` write-on-read violation (extract streak update to a separate function) | Low |
| 🟡 P1 | Deduplicate `getWeekStartDate` / `getMondayDateString` into `utils/` | Low |
| 🟠 P2 | Centralise `getDbConfig` into a single config module | Low |
| 🟠 P2 | Remove debug `console.log` statements from user-db | Trivial |
| 🟠 P2 | Replace `apiFetchAndNotify` with composed side-effects | Low |
