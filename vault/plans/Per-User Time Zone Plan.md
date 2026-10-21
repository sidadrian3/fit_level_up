# Per-User Time Zone Implementation Plan

> **For agentic workers:** executed through the `feature` pipeline's Step 7 (coordinator + one sub-agent per task; Group A in worktrees). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Streaks, quest periods and the dashboard week are computed in the user's own IANA time zone, and domain rules stop reading the clock.

**Architecture:** better-auth `additionalFields` stores an optional, validated `timeZone` on the user document. Pure calendar helpers in `src/lib/utils/dates.ts` turn an instant plus a zone into a local day, and a local day into its first instant. Each domain rule takes `(now, timeZone)`. Services read the clock and the user's zone and pass both down. Stored shapes are unchanged: `lastActivityDate` stays a UTC-midnight `Date`, which now holds the *local* day.

**Tech Stack:** Next.js 16, TypeScript, MongoDB (in-memory replica set in tests), better-auth 1.6, Zod 4, Vitest, `Intl` (Node 24, no Temporal).

**Spec:** [[Per-User Time Zone Design Spec]]

## Global Constraints

- Day strings are `YYYY-MM-DD`; weeks run Monday–Sunday.
- No domain rule (`src/lib/domain/**`) calls `new Date()` with no arguments or `Date.now()`.
- `timeZoneSchema` is synchronous (better-auth rejects async Standard Schemas).
- Missing `timeZone` reads as `"UTC"`. better-auth gets no `defaultValue`, so "missing" stays detectable.
- `lastActivityDate` is written as `new Date(`${localDay}T00:00:00Z`)`.
- Range queries use `$gte from` / `$lt toExclusive` with `Date` instants.
- Service tests that move the clock use `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime(...)`. Faking timers stalls the Mongo driver. Restore with `vi.useRealTimers()` in `afterEach`.
- No `any`; follow `AGENTS.md`.

## Review Focus

1. **A browser zone the validator rejects** (e.g. a fixed offset): signup must still succeed with no `timeZone` sent. Pinned in Task 6 (`getBrowserTimeZone` returns `undefined`).
2. **A Sunday-night / Monday-morning boundary west of UTC**: the workout belongs to the local week, not the UTC one. Pinned in Task 5 (dashboard stats test).
3. **A skipped local midnight** (`America/Santiago`, 2026-09-06): `startOfLocalDay` returns the first existing instant of that day, not one from the day before. Pinned in Task 1.
4. **A user with no `timeZone` field** (every existing user): every path behaves exactly as UTC did. Pinned in Task 2 (`toUser`, `getUserTimeZoneFromDb`) and Task 3 (existing log-workout tests still pass unchanged).
5. **`TimeZoneSync` re-rendering**: it must call `updateUser` at most once per mount, even while the session refetches. Pinned in Task 6 by a ref guard; checked in UI verification.

---

### Task 1: Calendar helpers and the time zone schema

**Layer:** domain support (utils) + validation. **Builds on:** `src/lib/utils/dates.ts` (existing exports stay untouched until Task 7), `src/lib/validations/schemas.ts`.

**Files:**
- Modify: `src/lib/utils/dates.ts` (add exports; keep existing ones)
- Modify: `src/lib/validations/schemas.ts`
- Test: `src/lib/utils/__tests__/dates.test.ts` (create)

**Interfaces:**
- Produces:
  - `isValidTimeZone(timeZone: string): boolean`
  - `toLocalDay(instant: Date, timeZone: string): string`
  - `addDays(day: string, n: number): string`
  - `startOfWeek(day: string): string` (the Monday)
  - `startOfLocalDay(day: string, timeZone: string): Date`
  - `timeZoneSchema` (Zod string schema) in `schemas.ts`

- [ ] **Step 1: Write the failing tests** in `src/lib/utils/__tests__/dates.test.ts`:
  - `toLocalDay`:
    - `(new Date("2026-10-20T23:00:00Z"), "Asia/Manila")` → `"2026-10-21"`;
    - `(new Date("2026-10-21T04:00:00Z"), "America/New_York")` → `"2026-10-21"`;
    - `(same, "UTC")` → `"2026-10-21"`.
  - `addDays`: `("2026-03-31", 1)` → `"2026-04-01"`; `("2026-01-01", -1)` → `"2025-12-31"`.
  - `startOfWeek`: `"2026-10-25"` (Sunday) → `"2026-10-19"`; `"2026-10-19"` (Monday) → `"2026-10-19"`.
  - `startOfLocalDay`:
    - `("2026-10-21", "Asia/Manila")` → `2026-10-20T16:00:00.000Z`;
    - `("2026-03-08", "America/New_York")` → `2026-03-08T05:00:00.000Z`;
    - `("2026-03-09", "America/New_York")` → `2026-03-09T04:00:00.000Z`;
    - `("2026-11-01", "America/New_York")` → `2026-11-01T04:00:00.000Z`;
    - `("2026-09-06", "America/Santiago")` → `2026-09-06T04:00:00.000Z` (local clocks jump from 23:59:59 on the 5th to 01:00 on the 6th, so 01:00 is the day's first instant).
  - `isValidTimeZone`: `true` for `"UTC"`, `"Asia/Calcutta"`, `"Asia/Manila"`; `false` for `"+08:00"`, `"-05:00"`, `""`, `"Mars/Base"`.
  - `timeZoneSchema.safeParse("Asia/Manila").success === true`; `.safeParse("+08:00").success === false`; `.safeParse("x".repeat(65)).success === false`.

- [ ] **Step 2: Run** `npx vitest run src/lib/utils/__tests__/dates.test.ts`. Expected: FAIL (exports missing).

- [ ] **Step 3: Implement** the five helpers in `dates.ts`, and `timeZoneSchema = z.string().min(1).max(64).refine(isValidTimeZone, "Invalid time zone")` in `schemas.ts`.
  - `toLocalDay` uses `new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })`, cached in a module-level `Map<string, Intl.DateTimeFormat>`.
  - `addDays` and `startOfWeek` work through `Date.UTC` / `getUTCDay` on `${day}T00:00:00Z`.
  - `isValidTimeZone` returns `false` for `/^[+-]/` and otherwise tries the `Intl.DateTimeFormat` constructor.
  - `startOfLocalDay`:
    1. Let `guess = Date.UTC(y, m - 1, d)`.
    2. Compute the zone's offset at an instant from `formatToParts` (fields `year…second`, `hourCycle: "h23"`) as `asUtc(parts) - instant`.
    3. Set `t = guess - offset(guess)`, then `t = guess - offset(t)`.
    4. If `toLocalDay(t) !== day` (midnight skipped forward), step forward to the next whole hour until `toLocalDay(t) === day`.
    5. If `toLocalDay(t - 1h) === day` (midnight repeated), use the earlier instant.
    6. Return `new Date(t)`.

- [ ] **Step 4: Run** the same test. Expected: PASS. Then `npx eslint src/lib/utils/dates.ts src/lib/validations/schemas.ts src/lib/utils/__tests__/dates.test.ts && npm run typecheck`.

- [ ] **Step 5: Commit**
```bash
git add src/lib/utils/dates.ts src/lib/validations/schemas.ts src/lib/utils/__tests__/dates.test.ts
git commit -m "feat(dates): add time-zone-aware calendar helpers and timeZoneSchema"
```

---

### Task 2: Store `timeZone` on the user

**Layer:** auth config + data. **Builds on:** `src/lib/auth/server.ts`, `src/lib/data/user-db.ts`, `src/lib/types.ts`.

**Files:**
- Modify: `src/lib/auth/server.ts`
- Modify: `src/lib/types.ts` (`User.timeZone: string`)
- Modify: `src/lib/data/user-db.ts`:
  - `UserMongoDoc.timeZone?: string`;
  - `toUser` maps it with a `"UTC"` fallback;
  - add `getUserTimeZoneFromDb`;
  - **delete** `updateUserStreakOnActivity` and `updateUserStreakInDb` (no callers);
  - drop the now-unused `calcNewStreak` import.
- Test: `src/lib/services/__tests__/user-time-zone.test.ts` (create)

**Interfaces:**
- Consumes: `timeZoneSchema` (Task 1).
- Produces:
  - `User.timeZone: string` (always set; `"UTC"` when absent in the document).
  - `getUserTimeZoneFromDb(userId: string, session?: ClientSession): Promise<string>`: a projection `{ timeZone: 1 }` read by `_id` (via `parseObjectId`); returns `"UTC"` when the user or the field is missing.
  - better-auth `user.additionalFields.timeZone = { type: "string", required: false, input: true, validator: { input: timeZoneSchema } }`. No `defaultValue`.

- [ ] **Step 1: Write the failing tests** in `user-time-zone.test.ts` (in-memory replica set; delete created users in `afterEach`):
  - `"stores a valid timeZone sent at signup"`: `auth.api.signUpEmail({ body: { email, password: "password-123", name: "TZ", timeZone: "Asia/Manila" } })`, then `getUserTimeZoneFromDb(id)` → `"Asia/Manila"`.
  - `"rejects an invalid timeZone at signup"`: the same call with `timeZone: "+08:00"` rejects, and no user with that email exists.
  - `"reads UTC when the field is missing"`: insert a raw `UserMongoDoc` without `timeZone`. `getUserTimeZoneFromDb` → `"UTC"`, and `getUserFromDb(id)` → `.timeZone === "UTC"`.

- [ ] **Step 2: Run** `npx vitest run src/lib/services/__tests__/user-time-zone.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the changes listed under Files.

- [ ] **Step 4: Run** the test, then `npm run typecheck` (any test fixture building a `User` literal needs `timeZone`) and `npx eslint` on the changed files. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/auth/server.ts src/lib/types.ts src/lib/data/user-db.ts src/lib/services/__tests__/user-time-zone.test.ts
git commit -m "feat(users): store a validated per-user timeZone via better-auth additionalFields"
```

---

### Task 3: Streaks in the user's local calendar

**Layer:** domain + service. **Builds on:** `UserStateService`, `logWorkout`, `logRun`, `sweepLockedAchievements`.

**Files:**
- Modify: `src/lib/domain/user-rules.ts` (`calcNewStreak`, `calcDisplayStreak`)
- Modify: `src/lib/services/users/user-state.service.ts`
- Modify: `src/lib/services/workouts/log-workout.ts`, `src/lib/services/runs/log-run.ts`
- Modify: `src/lib/services/achievements/sweep-locked-achievements.ts`
- Test: `src/lib/domain/__tests__/user-rules.test.ts`, `src/lib/services/__tests__/log-workout.test.ts`, `src/lib/services/__tests__/sweep-locked-achievements.test.ts`

**Interfaces:**
- Consumes: `toLocalDay`, `addDays` (Task 1); `User.timeZone` (Task 2).
- Produces:
  - `calcNewStreak(currentStreak: number | undefined, lastActivityDay: string | undefined, now: Date, timeZone: string): number`
  - `calcDisplayStreak(rawStreak: number, lastActivityDay: string | undefined, now: Date, timeZone: string): number`
  - `ActivityPayload.activityAt: Date` (replaces `activityDate`)
  - In `logWorkout`/`logRun`: `const now = new Date()`, used for the inserted `date` and `activityAt`. Task 4 also passes it to quests.

- [ ] **Step 1: Write the failing tests.**
  - Rewrite the `calcNewStreak` and `calcDisplayStreak` blocks in `user-rules.test.ts`:
    - `calcNewStreak(5, "2026-10-20", new Date("2026-10-20T23:00:00Z"), "Asia/Manila")` → `6` (local day 2026-10-21);
    - the same instant in `"UTC"` → `5` (same day);
    - `calcNewStreak(5, "2026-10-20", new Date("2026-10-22T03:00:00Z"), "America/New_York")` → `6` (local 2026-10-21);
    - `calcNewStreak(5, "2026-10-18", new Date("2026-10-21T12:00:00Z"), "UTC")` → `1`;
    - `calcNewStreak(undefined, undefined, anyNow, "UTC")` → `1`;
    - `calcDisplayStreak(5, "2026-10-20", new Date("2026-10-21T20:00:00Z"), "Asia/Manila")` → `0` (local 2026-10-22, so 2026-10-20 is two days back);
    - the same instant in `"UTC"` → `5`;
    - `calcDisplayStreak(0, undefined, now, "UTC")` → `0`.
  - Add to `log-workout.test.ts`: `"extends the streak on the user's local day"`.
    - Set the user to `timeZone: "Asia/Manila"`, `streak: 3`, `lastActivityDate: new Date("2026-10-20T00:00:00Z")`.
    - Fake `Date` at `2026-10-20T23:30:00Z` and log a workout.
    - Expect the user doc to have `streak === 4` and `lastActivityDate.toISOString() === "2026-10-21T00:00:00.000Z"`.
  - Add to `sweep-locked-achievements.test.ts`: a user whose `lastActivityDate` is 60 hours ago is processed, and one at 4 days ago is not (adjust the existing inactive fixture from 3 days to 4).

- [ ] **Step 2: Run** `npx vitest run src/lib/domain/__tests__/user-rules.test.ts src/lib/services/__tests__/log-workout.test.ts src/lib/services/__tests__/sweep-locked-achievements.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **Rules:**
    - drop the `Date` branch and the `new Date()` default;
    - "today" is `toLocalDay(now, timeZone)`;
    - "yesterday" is `addDays(today, -1)`;
    - the day gap comes from comparing day strings (`addDays(lastActivityDay, 1) === today` means consecutive).
  - **`UserStateService.getUser`:** passes `new Date()` and `rawUser.timeZone`.
  - **`applyActivity`:**
    - stores `lastActivityDate: new Date(`${toLocalDay(payload.activityAt, user.timeZone)}T00:00:00Z`)`;
    - calls `calcNewStreak(user.streak, user.lastActivityDate, payload.activityAt, user.timeZone)`;
    - keeps `new Date()` for stamina as today.
  - **`logWorkout`/`logRun`:** create `now` once, and pass `date: now` and `activityAt: now`.
  - **Sweep:** look back 72 hours. Add a one-line comment saying why: the local-day encoding puts a day's midnight up to 36 h before the activity (UTC−12).

- [ ] **Step 4: Run** the three test files, then `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/domain/user-rules.ts src/lib/services/users/user-state.service.ts src/lib/services/workouts/log-workout.ts src/lib/services/runs/log-run.ts src/lib/services/achievements/sweep-locked-achievements.ts src/lib/domain/__tests__/user-rules.test.ts src/lib/services/__tests__/log-workout.test.ts src/lib/services/__tests__/sweep-locked-achievements.test.ts
git commit -m "feat(streaks): compute streaks on the user's local calendar day"
```

---

**Group A: Tasks 4, 5 and 6.** Each depends only on Tasks 1–3, they touch disjoint files, and none of them edits `src/lib/utils/dates.ts` (Task 7 removes the old exports afterwards).

### Task 4: Quest periods in the user's local calendar

**Group:** A
**Files:** `src/lib/domain/quest-rules.ts`, `src/lib/services/quests/sync-user-quests.ts`, `src/lib/services/quests/update-quest-progress.ts`, `src/lib/services/quests/get-user-quests.ts`, `src/lib/services/quests/claim-quest-reward.ts`, `src/lib/data/quests-db.ts`, `src/lib/services/workouts/log-workout.ts`, `src/lib/services/runs/log-run.ts`, `src/lib/domain/__tests__/quest-rules.test.ts` (create), `src/lib/services/__tests__/update-quest-progress.test.ts`

**Layer:** domain + service + data.

**Interfaces:**
- Consumes: `toLocalDay`, `addDays`, `startOfWeek` (Task 1); `getUserTimeZoneFromDb`, `User.timeZone` (Task 2); `now` in `logWorkout`/`logRun` (Task 3).
- Produces:
  - `getPeriodForCategory(category: QuestCategory, now: Date, timeZone: string): { periodStart: string; periodEnd: string }`
  - `QuestCalendar = { now: Date; timeZone: string }`, exported from `sync-user-quests.ts`. Its only callers are quest services and the two log services, so it stays local to the quest module.
  - `ensureUserQuestRows(userId, templates, calendar: QuestCalendar, session?)`
  - `syncUserQuests(userId, calendar: QuestCalendar)`
  - `updateQuestProgress(userId, activity, calendar: QuestCalendar, session)`
  - `getUserQuestsForUserFromDb(userId: string, today: string, session?: ClientSession)`
  - `getUserQuests(userId)` and `claimQuestReward(userId, questId)` keep their signatures and build the calendar from `new Date()` + `getUserTimeZoneFromDb(userId)`.

- [ ] **Step 1: Write the failing tests.**
  - `quest-rules.test.ts`:
    - `getPeriodForCategory("daily", new Date("2026-10-25T17:00:00Z"), "Asia/Manila")` → `{ "2026-10-26", "2026-10-26" }`;
    - `"weekly"` at the same instant → `{ "2026-10-26", "2026-11-01" }`;
    - `"weekly"` at the same instant in `"UTC"` → `{ "2026-10-19", "2026-10-25" }`;
    - `"weekly"` at `new Date("2026-10-26T03:00:00Z")` in `"America/New_York"` → `{ "2026-10-19", "2026-10-25" }`;
    - `"all-time"` → `{ "all-time", "all-time" }`.
  - `update-quest-progress.test.ts`, `"credits the local-day period row"`:
    - set the user's `timeZone: "Asia/Manila"` and fake `Date` at `2026-10-20T23:00:00Z`;
    - log a workout;
    - the daily row has `periodStart === "2026-10-21"` and `progress === 1`;
    - `getUserQuests(userId)` returns it.

- [ ] **Step 2: Run** `npx vitest run src/lib/domain/__tests__/quest-rules.test.ts src/lib/services/__tests__/update-quest-progress.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `getPeriodForCategory`: per the spec §5, and drop the `utils/dates` imports of the old helpers.
  - Thread `calendar` through `ensureUserQuestRows`, `syncUserQuests` and `updateQuestProgress` (including its own `getPeriodForCategory` call).
  - `getUserQuestsForUserFromDb`: uses the passed `today`.
  - `logWorkout`/`logRun`: pass `{ now, timeZone: user.timeZone }`.

- [ ] **Step 4: Run** both tests, then `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** (in the worktree)
```bash
git add <Files above>
git commit -m "feat(quests): compute quest periods in the user's time zone"
```

### Task 5: Dashboard week in the user's local calendar

**Group:** A
**Files:** `src/lib/domain/user-rules.ts`, `src/lib/services/users/get-dashboard-stats.ts`, `src/lib/data/workout-db.ts`, `src/lib/data/runs-db.ts`, `src/app/(app)/dashboard/page.tsx`, `src/lib/domain/__tests__/user-rules.test.ts`, `src/lib/services/__tests__/get-dashboard-stats.test.ts` (create)

**Layer:** domain + data + service + page.

**Interfaces:**
- Consumes: `toLocalDay`, `addDays`, `startOfWeek`, `startOfLocalDay` (Task 1); `User.timeZone` (Task 2).
- Produces:
  - `calcActiveDays(activityInstants: Date[], now: Date, timeZone: string): boolean[]` (index 0 = Monday)
  - `countWorkoutsInRange(userId: string, from: Date, toExclusive: Date): Promise<number>`
  - `getTotalDistanceInRange(userId: string, from: Date, toExclusive: Date): Promise<number>`
  - `getWorkoutDatesInRange(userId: string, from: Date, toExclusive: Date): Promise<Date[]>` in `workout-db.ts` (projection `{ date: 1 }`, uses `idx_workouts_userId_date`; no new index)
  - `getDashboardStats(userId, user)`: signature unchanged.

- [ ] **Step 1: Write the failing tests.**
  - `user-rules.test.ts`, `calcActiveDays`:
    - `now = 2026-10-22T02:00:00Z` in `"America/New_York"` (local Wed 2026-10-21) with instants `[2026-10-20T03:00:00Z (local Mon 19th 23:00), 2026-10-21T15:00:00Z (local Wed), 2026-10-19T03:00:00Z (local Sun 18th, previous week)]` → `[true, false, true, false, false, false, false]`.
  - `get-dashboard-stats.test.ts` (fake `Date` at `2026-10-22T02:00:00Z`, user `timeZone: "America/New_York"`):
    - Insert workouts at `2026-10-19T03:00:00Z` (local Sun 18th, last week), `2026-10-20T03:00:00Z` (local Mon 19th, this week) and `2026-10-12T05:00:00Z` (local Mon 12th, last week).
    - Insert runs at `2026-10-20T12:00:00Z` (5 km) and `2026-10-19T03:00:00Z` (3 km).
    - Expect `weeklyWorkouts === 1`, `lastWeekWorkouts === 2` (the Sunday one is counted), `weeklyDistance === 5`.

- [ ] **Step 2: Run** `npx vitest run src/lib/domain/__tests__/user-rules.test.ts src/lib/services/__tests__/get-dashboard-stats.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - `getDashboardStats`: computes the three instants per spec §7 and stops importing `getMondayDateString` and `getLastWeekBoundaries`.
  - The range functions switch to `$gte`/`$lt`.
  - The dashboard page:
    - computes `now` and `weekFrom`/`weekTo` from `user.timeZone`;
    - calls `getWorkoutDatesInRange`;
    - passes the result to `calcActiveDays(dates, now, user.timeZone)`.

    It still uses `getAllWorkoutsFromDb` for the three recent workouts; F-9 belongs to step 3.4.

- [ ] **Step 4: Run** both tests, then `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** (in the worktree)
```bash
git add <Files above>
git commit -m "feat(dashboard): use the user's local week for stats and active days"
```

### Task 6: Capture the browser time zone

**Group:** A
**Files:** `src/lib/auth/client.ts`, `src/lib/utils/browser-time-zone.ts` (create), `src/components/auth/TimeZoneSync.tsx` (create), `src/app/(auth)/signup/page.tsx`, `src/app/(app)/layout.tsx`

**Layer:** component + page. The contract (better-auth field + validator) shipped in Task 2.

**Interfaces:**
- Consumes: `isValidTimeZone` (Task 1); the `timeZone` additional field (Task 2).
- Produces:
  - `getBrowserTimeZone(): string | undefined`
  - `<TimeZoneSync />`: renders `null`.
  - `authClient` gains `plugins: [inferAdditionalFields<typeof auth>()]` from `better-auth/client/plugins`, using a type-only import of `auth`.

- [ ] **Step 1: Implement `getBrowserTimeZone`.** It returns `Intl.DateTimeFormat().resolvedOptions().timeZone` when `isValidTimeZone` accepts it, else `undefined`. There is no unit test: it is a pass-through over Task 1's tested validator.

- [ ] **Step 2: Signup.** Add `timeZone: getBrowserTimeZone()` to the `authClient.signUp.email` call. The key is omitted when the value is `undefined`.

- [ ] **Step 3: `TimeZoneSync`.** A `"use client"` component:
  - reads `authClient.useSession()`;
  - when `data?.user` exists, `data.user.timeZone` is missing, `getBrowserTimeZone()` returns a value, and a `useRef` guard is unset, it sets the guard and calls `authClient.updateUser({ timeZone })`;
  - on error it logs a warning and leaves the guard set.

  Mount it in `src/app/(app)/layout.tsx` next to `<FriendEventManager />`.

- [ ] **Step 4: Check.** Run `npx eslint` on the five files and `npm run typecheck`. Expected: clean. (Behaviour is checked in Step 7b UI verification: sign up a fresh account, then the user document has `timeZone`. Unset the field on the throwaway account, load `/dashboard`, and it is set again.)

- [ ] **Step 5: Commit** (in the worktree)
```bash
git add <Files above>
git commit -m "feat(auth): capture the browser time zone at signup and backfill it in the app"
```

---

### Task 7: Remove the UTC-only date helpers

**Layer:** utils. **Builds on:** Group A having removed every caller.

**Files:**
- Modify: `src/lib/utils/dates.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `dates.ts` exports only Task 1's helpers.

- [ ] **Step 1: Confirm there are no callers.** Run `grep -rn "getTodayDateString\|getMondayDateString\|getSundayDateString\|getLastWeekBoundaries" src`. Expected: matches only in `src/lib/utils/dates.ts`.
- [ ] **Step 2: Delete those four functions.**
- [ ] **Step 3: Run** `npm run typecheck && npm run test:run`. Expected: PASS. Also run `grep -rn "new Date()" src/lib/domain --include='*.ts' | grep -v __tests__`. Expected: only `muscle-evaluator.ts` (deferred to step 3.4).
- [ ] **Step 4: Commit**
```bash
git add src/lib/utils/dates.ts
git commit -m "feat(dates): drop the UTC-only date helpers"
```

[[Plans Index]]
