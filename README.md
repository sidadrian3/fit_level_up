# FitLevelUp

A gamified fitness tracking web application that turns your workouts and runs into an RPG progression experience. Earn XP, level up, complete quests, unlock achievements, and maintain your daily activity streak.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Available Scripts](#available-scripts)
- [Testing](#testing)

---

## Features

- **Workout Logging** — Log gym sessions with exercises, sets, reps, weight, and duration.
- **Run Tracking** — Log runs with distance, duration, pace auto-calculation, and difficulty rating.
- **XP & Levelling System** — Earn XP for every activity. Level up as your XP accumulates (each level requires `level × 500 XP`).
- **Activity Streaks** — Consecutive daily activity builds and maintains a streak counter.
- **Quests** — Daily, weekly, and special quests tied to workout and run metrics (count, distance).
- **Achievements** — Milestone-based badges unlocked by total workouts, distance, level, and streak.
- **Dashboard** — At-a-glance stats including weekly trends, lifetime XP, and active day tracker.
- **Custom Exercises** — Create and save your own exercises to use across workouts.
- **Authentication** — Email/password sign-up and sign-in via Better Auth.
- **Stamina System** — Stamina regeneration mechanic tracked per user.

---

## Tech Stack

| Layer                  | Technology                                               |
| ---------------------- | -------------------------------------------------------- |
| Framework              | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| Language               | TypeScript 5                                             |
| Database               | MongoDB 7 (Atlas or local Docker)                        |
| Auth                   | [Better Auth](https://better-auth.com)                   |
| Data Fetching (Client) | [TanStack Query v5](https://tanstack.com/query)          |
| Styling                | Tailwind CSS v4                                          |
| Schema Validation      | [Zod v4](https://zod.dev)                                |
| Env Validation         | [@t3-oss/env-nextjs](https://env.t3.gg)                  |
| Unit Tests             | [Vitest](https://vitest.dev) + `mongodb-memory-server`   |
| E2E Tests              | [Playwright](https://playwright.dev)                     |
| Icons                  | [Lucide React](https://lucide.dev)                       |

---

## Architecture

The codebase follows a **Clean Architecture / Application Service** pattern with strict separation of concerns across three backend layers:

```
┌─────────────────────────────────────────────┐
│             Next.js API Routes              │  ← Thin adapters: parse request, call service
├─────────────────────────────────────────────┤
│              Services Layer                 │  ← Use-case orchestration (e.g. logWorkout)
│         src/lib/services/{domain}/          │    Validates → Calculates → Persists → Side-effects
├─────────────────────────────────────────────┤
│               Domain Layer                  │  ← Pure business rules (zero infrastructure deps)
│         src/lib/domain/*-rules.ts           │    XP formulas, streak logic, quest rules, etc.
├─────────────────────────────────────────────┤
│                Data Layer                   │  ← MongoDB CRUD only, no business logic
│           src/lib/data/*-db.ts              │    Maps DB documents ↔ TypeScript domain types
└─────────────────────────────────────────────┘
```

**Key architectural decisions:**

- **Domain rules are pure functions** — testable without a database or any side effects.
- **`-db.ts` files only persist** — they do not calculate XP, evaluate quests, or call other modules.
- **Services orchestrate** — the service layer calls domain → data → side effects in sequence.
- **API routes are thin** — they extract `userId` from the session, call the service, and return the response.
- **Singleton MongoDB client** — uses a `global` variable in development to survive hot-reloads.
- **Edge middleware auth** — `src/proxy.ts` protects routes at the Next.js middleware level.

---

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Protected app pages
│   │   ├── dashboard/
│   │   ├── workouts/
│   │   ├── runs/
│   │   ├── quests/
│   │   └── profile/
│   ├── (auth)/             # Public auth pages (login, signup)
│   ├── (landing)/          # Public marketing/landing page
│   └── api/                # API route handlers
│       ├── workouts/
│       ├── runs/
│       ├── quests/
│       ├── achievements/
│       ├── exercises/
│       ├── profile/
│       ├── stats/
│       ├── user/
│       └── auth/           # Better Auth handler
├── components/             # Shared React components
├── lib/
│   ├── data/               # MongoDB access layer (*-db.ts)
│   │   └── api-client/     # Client-side fetch wrappers (used by TanStack Query)
│   ├── domain/             # Pure business rules (*-rules.ts)
│   ├── services/           # Use-case orchestration
│   │   ├── workouts/
│   │   ├── runs/
│   │   ├── quests/
│   │   ├── achievements/
│   │   ├── exercises/
│   │   └── users/
│   ├── auth/               # Better Auth server config & helpers
│   ├── context/            # React context providers
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Pure utility functions (formatters, calculations, dates)
│   ├── validations/        # Zod schemas for API input validation
│   ├── types.ts            # Shared TypeScript domain types
│   └── mongodb.ts          # MongoDB singleton client
├── scripts/                # One-off scripts (DB seeding, migrations)
├── env.ts                  # Type-safe environment variable validation
└── proxy.ts                # Next.js edge middleware (route protection)
```

---

## Getting Started

### Prerequisites

- **Node.js** `>=18` (v20+ recommended)
- **npm** `>=9`
- A **MongoDB** instance — either [MongoDB Atlas](https://www.mongodb.com/atlas) (cloud) or Docker (local)

### 1. Clone the repository

```bash
git clone <repo-url>
cd fit_level_up
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example below into a `.env.local` file in the project root:

```bash
# .env.local

# MongoDB — Atlas connection string OR local (see Database Setup below)
MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<AppName>"
# OR for local Docker:
# MONGODB_URI="mongodb://localhost:27017"

# The name of the MongoDB database to use
MONGODB_DB="fitlevelup"

# The public URL of this app (used by Better Auth)
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
```

> All collection names have sensible defaults (`workouts`, `runs`, `user_quests`, etc.) and do not need to be set unless you want to override them.

### 4. Seed the database

Run the achievement seed script to populate the initial achievements:

```bash
npm run seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

| Variable                               | Required | Default             | Description                    |
| -------------------------------------- | -------- | ------------------- | ------------------------------ |
| `MONGODB_URI`                          | Yes      | —                   | Full MongoDB connection string |
| `MONGODB_DB`                           | Yes      | —                   | Database name                  |
| `NEXT_PUBLIC_BETTER_AUTH_URL`          | Yes      | —                   | App base URL for Better Auth   |
| `MONGODB_WORKOUTS_COLLECTION`          | No       | `workouts`          | Collection name override       |
| `MONGODB_RUNS_COLLECTION`              | No       | `runs`              | Collection name override       |
| `MONGODB_QUEST_TEMPLATES_COLLECTION`   | No       | `quest_templates`   | Collection name override       |
| `MONGODB_USER_QUESTS_COLLECTION`       | No       | `user_quests`       | Collection name override       |
| `MONGODB_ACHIEVEMENTS_COLLECTION`      | No       | `achievements`      | Collection name override       |
| `MONGODB_USER_ACHIEVEMENTS_COLLECTION` | No       | `user_achievements` | Collection name override       |
| `MONGODB_CUSTOM_EXERCISES_COLLECTION`  | No       | `customExercises`   | Collection name override       |

All variables are validated at startup by `src/env.ts` using `@t3-oss/env-nextjs` + Zod. The server will refuse to start if any required variable is missing or malformed.

---

## Database Setup

### Option A: MongoDB Atlas (Cloud)

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a database user and whitelist your IP.
3. Copy the connection string into `MONGODB_URI` in `.env.local`.
4. Run `npm run seed` to populate achievement data.

### Option B: Local Docker

The project ships with a `docker-compose.yml` that runs MongoDB 7 as a Replica Set (required for multi-document transactions).

```bash
# Start MongoDB in the background
docker compose up -d

# Verify the container is healthy
docker compose ps
```

Set your `MONGODB_URI` to:

```
MONGODB_URI="mongodb://localhost:27017"
```

> **Note:** The Docker setup uses a Replica Set (`rs0`) to support MongoDB transactions. The `healthcheck` in `docker-compose.yml` automatically initialises the replica set on first start.

---

## Available Scripts

| Script            | Command            | Description                                                  |
| ----------------- | ------------------ | ------------------------------------------------------------ |
| Dev server        | `npm run dev`      | Starts Next.js with Turbopack on `http://localhost:3000`     |
| Production build  | `npm run build`    | Runs DB migrations then builds the Next.js production bundle |
| Production server | `npm run start`    | Starts the production Next.js server                         |
| Lint              | `npm run lint`     | Runs ESLint across the project                               |
| Seed DB           | `npm run seed`     | Seeds the `achievements` collection with initial data        |
| Unit tests        | `npm test`         | Runs Vitest unit tests (with in-memory MongoDB)              |
| E2E tests         | `npm run test:e2e` | Runs Playwright end-to-end tests against `localhost:3000`    |

---

## Testing

### Unit Tests (Vitest)

Unit tests live alongside the code they test in `__tests__/` subdirectories. They use `mongodb-memory-server` to run a real (in-memory) MongoDB instance — no external DB required.

```bash
npm test

# Or with the interactive Vitest UI:
npx vitest --ui
```

Tests cover the domain rules (pure functions) and data layer operations.

### E2E Tests (Playwright)

End-to-end tests live in `tests/e2e/`. Playwright tests run against a live dev server on `localhost:3000`.

```bash
# Ensure the dev server is running first (or Playwright will start it automatically)
npm run test:e2e

# View the HTML test report
npx playwright show-report
```
