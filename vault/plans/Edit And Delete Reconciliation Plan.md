# Edit And Delete Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editing or deleting a workout or run reverses its XP, level, totals, quest progress and (on delete) streak, and the XP ledger is backfilled for everything logged before step 3.1.

**Architecture:** Training's update and delete use cases become transactions that call two new progression functions (`replaceSourceXp`, `revokeSource`) and a new quests function (`recountQuestProgress`). Progression and quests read activity data only through callbacks training passes (`ActivityDays`, `QuestMeasure`), so no import cycle forms. A `highestLevel` high-water mark gates every level-up. Migration 005 backfills the ledger and resets profile XP and totals.

**Tech Stack:** Next.js 16 route handlers, MongoDB driver transactions, Vitest against the in-memory replica set.

**Spec:** [[Edit And Delete Reconciliation Design Spec]] (`vault/specs/Edit And Delete Reconciliation Design Spec.md`). Read its Contract section before any task.

## Global Constraints

- Read `AGENTS.md` before writing code. No `any`, including in tests.
- Every query on user-owned data is scoped by `userId` (`userScopedRepository`, or `{ _id: userId }` on `player_profiles`).
- Operations inside one transaction run sequentially; never `Promise.all` with a session.
- Domain rules are pure: no clock, no I/O. `now` and the time zone are arguments.
- `totalXp` after an edit, delete or clawback is the ledger sum, never a `$inc` of a difference.
- `leveledUp` and `progression.leveled-up` fire only when the new level exceeds `highestLevel`.
- Route handlers, their request schemas and their response shapes do not change.
- Stamina is never read or written by edit, delete or the backfill.
- Services are tested against the real replica set; only progression's and quests' callback inputs (`ActivityDays`, `QuestMeasure`) are supplied as plain in-memory functions.

## Review Focus

1. **Concurrent deletes on one profile** — two deletes in parallel both land: `totalWorkouts` drops by 2 and `totalXp` equals the ledger sum (Task 6).
2. **An old activity recounts its own period** — deleting a workout from a previous week recounts that week's quest row, not the current week's (Task 6).
3. **Local day, not UTC day** — a workout at `2026-03-09T20:00Z` for an `Asia/Manila` user belongs to `2026-03-10` for both the streak and the daily quest (Task 6).
4. **An unchanged edit is a no-op for game state** — saving a workout with the same values leaves `totalXp`, `highestLevel` and the outbox unchanged (Task 6).
5. **Raw distance** — runs totalling 14.96 km never complete the 15 km weekly quest after an edit or delete (Task 7).

---

### Task 1: `highestLevel` and the level-up high-water rule

**Layer:** data + service. **Group:** A.
**Files:** `src/server/platform/database/schema.ts`, `src/server/progression/profile.repository.ts`, `src/server/progression/add-xp.ts`, `src/testing/players.ts`, `src/server/progression/__tests__/grant-xp.test.ts`, `src/scripts/migrations/003-backfill-player-profiles.ts`

**Interfaces:**
- Consumes: `levelFromTotalXp` (existing), `emit` (existing).
- Produces:
  - `PlayerProfileDoc.highestLevel: number`, required in the `playerProfiles` validator (`number`, like `totalXp`).
  - `newProfileDefaults(now)` includes `highestLevel: 1`.
  - `raiseHighestLevel(userId: string, level: number, session: ClientSession): Promise<void>` in `profile.repository.ts` (`$max: { highestLevel: level }`).
  - `settleLevelUp(userId: string, profile: PlayerProfileDoc, session: ClientSession): Promise<boolean>` exported from `add-xp.ts`: computes `levelFromTotalXp(profile.totalXp).level`; if it exceeds `profile.highestLevel`, raises it and emits `progression.leveled-up` with `{ userId, previousLevel: profile.highestLevel, newLevel }`; returns whether it did. `addXp` uses it in place of its current before/after comparison. Task 3 reuses it.
  - `seedPlayer` defaults `highestLevel` to `levelFromTotalXp(profile.totalXp ?? 0).level`, so existing fixtures keep their level-up behaviour.
  - Migration 003's `$setOnInsert` also sets `highestLevel: levelFromTotalXp(calcLifetimeXp(level, xp)).level`, because the validator now requires the field and 003 runs before 005 on a fresh database. No new test: the existing 003 tests cover it by passing the validator.

- [ ] **Step 1: Write the failing tests** in `grant-xp.test.ts`:
  - `"does not level up again below the highest level reached"`: seed `{ totalXp: 450, highestLevel: 2 }`, grant 100 → `leveledUp === false`, no `progression.leveled-up` row, `player.level === 2`.
  - `"reports the previous highest level in the event"`: seed `{ totalXp: 950, highestLevel: 2 }`, grant 600 (total 1550, level 3) → one event with payload `{ userId, previousLevel: 2, newLevel: 3 }`, stored `highestLevel === 3`.
- [ ] **Step 2: Run** `npx vitest run src/server/progression/__tests__/grant-xp.test.ts` — expect the two new tests to FAIL (type error or wrong `leveledUp`).
- [ ] **Step 3: Implement** the Produces list. `incrementTotalXp`'s `$setOnInsert` defaults pick up `highestLevel: 1` through `newProfileDefaults`.
- [ ] **Step 4: Run** `npx vitest run src/server/progression` and `npm run typecheck` — expect PASS, with every pre-existing progression test unchanged.
- [ ] **Step 5: Commit** `feat(progression): highestLevel high-water mark gates level-ups`

### Task 2: Pure streak and period rules

**Layer:** domain. **Group:** A.
**Files:** `src/server/progression/progression.rules.ts`, `src/server/progression/__tests__/progression.rules.test.ts`, `src/server/quests/quest.rules.ts`, `src/server/quests/__tests__/quest.rules.test.ts`

Group A is independent: Task 1 changes profile storage and `addXp`, and this task adds pure functions in other files. Neither uses the other's output.

**Interfaces:**
- Consumes: `addDays`, `startOfLocalDay` from `@/shared/time/calendar`; `QuestPeriod` (existing).
- Produces:
  - `recountStreak(days: readonly string[]): { streak: number; lastActivityDay: string }` — `days` is non-empty, any order, may repeat; result is the run of consecutive days ending at the latest day.
  - `periodRange(period: QuestPeriod, timeZone: string): { from: Date; toExclusive: Date } | null` — `null` when `periodStart` is null; otherwise `[startOfLocalDay(periodStart), startOfLocalDay(addDays(periodEnd, 1)))`.

- [ ] **Step 1: Write the failing tests**
  - `recountStreak(["2026-03-10", "2026-03-09", "2026-03-07"])` → `{ streak: 2, lastActivityDay: "2026-03-10" }`
  - `recountStreak(["2026-03-07"])` → `{ streak: 1, lastActivityDay: "2026-03-07" }`
  - `recountStreak(["2026-03-08", "2026-03-10", "2026-03-09", "2026-03-10"])` → `{ streak: 3, lastActivityDay: "2026-03-10" }`
  - `periodRange({ periodStart: "2026-03-10", periodEnd: "2026-03-10" }, "Asia/Manila")` → `{ from: new Date("2026-03-09T16:00:00Z"), toExclusive: new Date("2026-03-10T16:00:00Z") }`
  - `periodRange({ periodStart: "2026-03-09", periodEnd: "2026-03-15" }, "UTC")` → `{ from: new Date("2026-03-09T00:00:00Z"), toExclusive: new Date("2026-03-16T00:00:00Z") }`
  - `periodRange({ periodStart: null, periodEnd: null }, "UTC")` → `null`
- [ ] **Step 2: Run** `npx vitest run src/server/progression/__tests__/progression.rules.test.ts src/server/quests/__tests__/quest.rules.test.ts` — expect FAIL (not exported).
- [ ] **Step 3: Implement** both functions.
- [ ] **Step 4: Run** the same command — expect PASS.
- [ ] **Step 5: Commit** `feat(progression,quests): pure streak recount and quest period range rules`

### Task 3: `replaceSourceXp` and `revokeSource`

**Layer:** service + data. **Group:** B.
**Files:** `src/server/progression/xp-ledger.repository.ts`, `src/server/progression/profile.repository.ts`, `src/server/progression/replace-source-xp.ts` (create), `src/server/progression/revoke-source.ts` (create), `src/server/progression/index.ts`, `src/testing/transactions.ts` (create), `src/server/progression/__tests__/grant-xp.test.ts`, `src/server/progression/__tests__/record-activity.test.ts`, `src/server/progression/__tests__/replace-source-xp.test.ts` (create), `src/server/progression/__tests__/revoke-source.test.ts` (create)

**Interfaces:**
- Consumes: `settleLevelUp`, `highestLevel` (Task 1); `recountStreak` (Task 2); `getUserTimeZone`, `toLocalDay`, `addDays`, `toPlayerState` (existing).
- Produces (exported from `@/server/progression`):
  - `type Totals = { workouts?: number; distanceKm?: number }` (moved from `ActivityUpdate` in `profile.repository.ts`, which then uses it).
  - `type ActivityDays = { since(fromDay: string): Promise<string[]>; latest(): Promise<string | null> }`
  - `replaceSourceXp(input: { userId: string; source: XpSource; amount: number; occurredAt: Date; totals: Totals }, session): Promise<{ player: PlayerState; leveledUp: boolean }>`
  - `revokeSource(input: { userId: string; source: XpSource; occurredAt: Date; totals: Totals; activityDays?: ActivityDays }, session): Promise<{ player: PlayerState }>`
  - Repository additions: `upsertXp(userId, { source, amount, occurredAt }, session)` (`$set amount`, `$setOnInsert` the rest), `deleteXp(userId, source, session)`, `sumXp(userId, session): Promise<number>`; `setTotalXp(userId, totalXp: number, totals: Totals, session): Promise<PlayerProfileDoc>` (one `findOneAndUpdate`: `$set totalXp`, `$inc` the non-zero totals, upsert with defaults, `returnDocument: "after"`); `setStreak(userId, streak: number, lastActivityDay: string | null, session)`.
  - `inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T>` in `src/testing/transactions.ts`; the two progression tests that define it locally import it instead.

Streak recount inside `revokeSource` follows the spec's four steps exactly ("Streak recount" section).

- [ ] **Step 1: Write the failing tests**
  - `replace-source-xp.test.ts`:
    - `"replaces the row and re-sums, levelling down"`: seed `{ totalXp: 600, highestLevel: 2 }` with ledger rows workout `w1` 550 and quest `q1` 50; `replaceSourceXp({ source: workout w1, amount: 100, totals: {} })` → one row for `w1` with `amount: 100`, `totalXp === 150`, `player.level === 1`, `leveledUp === false`, no outbox row.
    - `"levels up past the highest level once"`: seed one row `w1` 100, `{ totalXp: 100, highestLevel: 1 }`; replace with 600 → `leveledUp`, one event, `highestLevel === 2`.
    - `"inserts the row when it is missing"`: no rows, `totalXp: 750` → replace with 80 → one row, `totalXp === 80`.
    - `"applies the distance delta"`: `{ totalDistance: 10 }`, totals `{ distanceKm: -2.5 }` → `totalDistance === 7.5`.
  - `revoke-source.test.ts` (user time zone `UTC`; `activityDays` built from an in-memory array of days):
    - `"removes the row, re-sums and applies totals"`: rows `w1` 300 and `w2` 200, `{ totalWorkouts: 2 }` → revoke `w1` with `{ workouts: -1 }` → `totalXp === 200`, `totalWorkouts === 1`, no outbox row.
    - `"tolerates a missing row"`: no rows, `totalXp: 500` → `totalXp === 0`.
    - `"recounts a streak broken in the middle"`: `{ streak: 5, lastActivityDay: "2026-03-10" }`, delete occurred `2026-03-08T12:00Z`, remaining days `["2026-03-06", "2026-03-07", "2026-03-09", "2026-03-10"]` → `streak === 2`, `lastActivityDay === "2026-03-10"`.
    - `"keeps the streak when another activity shares the day"`: remaining days include `2026-03-08` → streak unchanged.
    - `"keeps the streak when the day is outside the window"`: delete occurred `2026-03-01` → unchanged, and `since` is never called.
    - `"falls back to the latest activity when the window empties"`: `{ streak: 1, lastActivityDay: "2026-03-10" }`, delete on `2026-03-10`, `since` → `[]`, `latest` → `"2026-03-02"` → `streak === 1`, `lastActivityDay === "2026-03-02"`; with `latest` → `null` → `streak === 0`, `lastActivityDay === null`.
    - `"does not touch the streak without activityDays"`.
- [ ] **Step 2: Run** `npx vitest run src/server/progression` — expect the new files to FAIL.
- [ ] **Step 3: Implement** the Produces list. `replaceSourceXp` calls `settleLevelUp` after `setTotalXp`; `revokeSource` never emits.
- [ ] **Step 4: Run** `npx vitest run src/server/progression` and `npm run typecheck` — expect PASS.
- [ ] **Step 5: Commit** `feat(progression): replaceSourceXp and revokeSource re-sum the ledger and recount the streak`

### Task 4: Migration 005 — backfill the XP ledger

**Layer:** data (migration). **Group:** B.
**Files:** `src/scripts/migrations/005-backfill-xp-ledger.ts` (create), `src/scripts/migrations/index.ts`, `src/scripts/migrations/__tests__/005-backfill-xp-ledger.test.ts` (create)

Group B is independent: the migration writes collections directly with the driver and needs only `highestLevel` (Task 1) and the existing `levelFromTotalXp` and `QUEST_DEFINITIONS`; it uses nothing Task 3 adds, and the two file lists are disjoint.

**Interfaces:**
- Consumes: `PlayerProfileDoc.highestLevel` (Task 1); `levelFromTotalXp` from `@/server/progression`; `QUEST_DEFINITIONS` from `@/server/quests`; `COLLECTIONS`; `Migration` from `./run-migrations`.
- Produces: `backfillXpLedgerMigration: Migration` with `name: "005-backfill-xp-ledger"`, registered last in `MIGRATIONS`.

Behaviour is the spec's "Migration 005" section. Build per-user sums with one `$group` aggregation per collection (ledger, workouts, runs) rather than a query per user, and write ledger rows and profile updates with batched `bulkWrite` (500, as in 003).

- [ ] **Step 1: Write the failing tests** (pattern: `003-backfill-player-profiles.test.ts`):
  - `"creates ledger rows for workouts, runs and claimed quests"`: one workout (`xpEarned: 120`), one run (`xpEarned: 80`), one claimed `daily_workout_1` row, one unclaimed row, one claimed row with an unknown `questTemplateId` → three rows: `workout` 120, `run` 80, `quest_claim` 100 with `sourceId` = the quest row's `_id` string.
  - `"keeps existing ledger rows"`: an existing `workout` row for the same workout with `amount: 90` stays 90.
  - `"resets XP, totals and highestLevel from the source data"`: profile `{ totalXp: 5000, totalWorkouts: 9, totalDistance: 40 }` with one workout (120 XP) and one 3.5 km run (80 XP) → `totalXp === 200`, `totalWorkouts === 1`, `totalDistance === 3.5`, `highestLevel === levelFromTotalXp(5000).level`.
  - `"is a no-op on a second run"`: run twice → identical ledger and profile documents (ignoring `updatedAt`).
- [ ] **Step 2: Run** `npx vitest run src/scripts/migrations/__tests__/005-backfill-xp-ledger.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** the migration and register it.
- [ ] **Step 4: Run** `npx vitest run src/scripts/migrations` and `npm run typecheck` — expect PASS.
- [ ] **Step 5: Commit** `feat(migrations): 005 backfills the xp ledger and resets profile XP and totals`

### Task 5: `recountQuestProgress` with claim clawback

**Layer:** service + data.
**Files:** `src/server/quests/recount-quest-progress.ts` (create), `src/server/quests/quest.repository.ts`, `src/server/quests/index.ts`, `src/server/quests/__tests__/recount-quest-progress.test.ts` (create)

**Interfaces:**
- Consumes: `periodRange` (Task 2); `revokeSource` (Task 3); `inTransaction` (Task 3); `getPeriodForCategory`, `QUEST_ENTRIES` (existing).
- Produces (exported from `@/server/quests`):
  - `type QuestMeasure = (metric: QuestMetric, range: { from: Date; toExclusive: Date } | null) => Promise<number>`
  - `recountQuestProgress(userId: string, input: { metrics: QuestMetric[]; occurredAt: Date; timeZone: string; measure: QuestMeasure }, session: ClientSession): Promise<void>`
  - Repository additions: `findQuestRow(userId, { questTemplateId, periodStart, periodEnd }, session)`, `setQuestRecount(userId, id, { progress, completed, claimed }, session)`.

Steps follow the spec's "Quests API" section; the clawback calls `revokeSource({ userId, source: { type: "quest_claim", id }, occurredAt: new Date(), totals: {} }, session)`.

- [ ] **Step 1: Write the failing tests** (time zone `UTC`, `measure` an in-memory function):
  - `"lowers progress and un-completes an unclaimed quest"`: `weekly_workouts_3` row for the week of `2026-03-10`, `progress: 3, completed: true`; measure returns 2 → `progress: 2, completed: false, claimed: false`.
  - `"claws back a claimed quest in a past week"`: same row `claimed: true`, a `quest_claim` ledger row (500) plus a workout row (100), profile `totalXp: 600` → measure returns 2 → row `claimed: false, completed: false`, the claim ledger row is gone, `totalXp === 100`.
  - `"caps progress at the target and completes"`: `daily_run_2km` row, measure returns 3.4 → `progress: 2, completed: true`.
  - `"passes the period range and null for all-time quests"`: `metrics: ["run_count"]` → measure called with `("run_count", null)` for `weekend_run_1`; `metrics: ["workout_count"]` with `occurredAt` `2026-03-10T08:00Z` → called with `{ from: 2026-03-10T00:00Z, toExclusive: 2026-03-11T00:00Z }` for the daily and the `2026-03-09`–`2026-03-16` range for the weekly.
  - `"skips periods without a row"`: no rows → no row is created.
- [ ] **Step 2: Run** `npx vitest run src/server/quests/__tests__/recount-quest-progress.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the Produces list.
- [ ] **Step 4: Run** `npx vitest run src/server/quests` and `npm run typecheck` — expect PASS.
- [ ] **Step 5: Commit** `feat(quests): recount quest progress for an activity's period and claw back unmet claims`

### Task 6: Workout edit and delete reconcile game state

**Layer:** service + data + page.
**Files:** `src/server/training/activity-days.ts` (create), `src/server/training/quest-measure.ts` (create), `src/server/training/events.ts`, `src/server/training/workouts/workout.repository.ts`, `src/server/training/runs/run.repository.ts`, `src/server/training/workouts/update-workout.ts`, `src/server/training/workouts/delete-workout.ts`, `src/server/training/workouts/__tests__/edit-delete-workout.test.ts` (create), `src/app/api/workouts/__tests__/item-route.test.ts`, `src/app/(app)/workouts/page.tsx`

**Interfaces:**
- Consumes: `replaceSourceXp`, `revokeSource`, `ActivityDays` (Task 3); `recountQuestProgress`, `QuestMeasure` (Task 5); `getUserTimeZone`, `emit`, `clientPromise`, `startOfLocalDay`, `toLocalDay` (existing).
- Produces:
  - `activityDays(userId: string, timeZone: string, session: ClientSession): ActivityDays` — `since` unions distinct local days (`$dateToString` with `format: "%Y-%m-%d"` and `timezone`) of workouts and runs with `date >= startOfLocalDay(fromDay)`; `latest` takes the newest `date` of either collection and returns its `toLocalDay`, or `null`.
  - `questMeasure(userId: string, session: ClientSession): QuestMeasure` — `workout_count` counts workouts, `run_count` counts runs, `run_distance` sums raw `distance` (no rounding); `range: null` means no date filter.
  - Repository additions (session-aware, `userId`-scoped): in both repositories `findActivityDaysSince(userId, from: Date, timeZone, session): Promise<string[]>` and `findLatestDate(userId, session): Promise<Date | null>`; in `workout.repository.ts` `findWorkoutById`, a session option on `updateWorkoutFields`, `deleteWorkoutById` returning `Workout | null`, `countWorkouts(userId, range | null, session)`; in `run.repository.ts` `countRuns(userId, range | null, session)` and `sumRunDistance(userId, range | null, session)`.
  - `"activity.reverted": { userId: string; activity: { type: "workout" | "run"; id: string } }` declared in `events.ts`.
  - `updateWorkout(id, input, userId): Promise<Workout | null>` and `deleteWorkout(userId, workoutId): Promise<boolean>` keep their signatures.

Use-case steps are the spec's "Training use cases" table. The workouts page's `deleteMutation.onSuccess` also invalidates `["user"]`.

- [ ] **Step 1: Write the failing tests** in `edit-delete-workout.test.ts` (log through `logWorkout` where the test needs ledger rows; seed rows directly where it needs a past date):
  - `"edit down replaces the ledger row and lowers the level"`: log a 300-minute workout from level 1 → level ≥ 2; edit to 1 minute → ledger `amount` equals the new `xpEarned`, `totalXp` equals the ledger sum, level is 1, no second `progression.leveled-up` row.
  - `"an unchanged edit leaves game state as it was"` (Review Focus 4).
  - `"delete removes XP and the workout total and emits activity.reverted"`: one `activity.reverted` row with payload `{ userId, activity: { type: "workout", id } }`; `totalWorkouts` back to 0; today's `daily_workout_1` progress 0.
  - `"delete recounts the quest of the workout's own week"` (Review Focus 2): a workout seeded on `2026-03-03` with a claimed `weekly_workouts_3` row for `2026-03-02`–`2026-03-08` and two more workouts that week → after delete the row is unclaimed and incomplete and the claim XP is gone; the current week's row is untouched.
  - `"delete recounts the streak on the user's local day"` (Review Focus 3): `Asia/Manila` user, workouts at `2026-03-08T20:00Z`, `2026-03-09T20:00Z`, `2026-03-10T20:00Z`, profile `{ streak: 3, lastActivityDay: "2026-03-11" }`; delete the middle one → `streak === 1`, `lastActivityDay === "2026-03-11"`.
  - `"concurrent deletes both land"` (Review Focus 1): two logged workouts deleted with `Promise.all` of two `deleteWorkout` calls → `totalWorkouts === 0`, `totalXp` equals the ledger sum (0).
  - `"another user's workout is not found and nothing changes"`: `deleteWorkout` returns `false`, profile and ledger unchanged.
  - In `item-route.test.ts`, replace `"DELETE does not change the user's XP or totals"` with `"DELETE reverses the workout's XP and total"`: the seeded row with a matching ledger row of 1 XP → `totalXp` equals the ledger sum and `totalWorkouts === 3`.
- [ ] **Step 2: Run** `npx vitest run src/server/training/workouts src/app/api/workouts` — expect the new tests to FAIL.
- [ ] **Step 3: Implement** the Produces list, the two use cases and the page invalidation.
- [ ] **Step 4: Run** `npx vitest run src/server/training src/app/api/workouts` and `npm run typecheck` — expect PASS.
- [ ] **Step 5: Commit** `feat(training): workout edit and delete reconcile XP, totals, quests and streak`

### Task 7: Run edit and delete reconcile game state

**Layer:** service + data + page.
**Files:** `src/server/training/runs/run.repository.ts`, `src/server/training/runs/update-run.ts`, `src/server/training/runs/delete-run.ts`, `src/server/training/runs/__tests__/edit-delete-run.test.ts` (create), `src/app/api/runs/__tests__/item-route.test.ts`, `src/app/(app)/runs/page.tsx`

**Interfaces:**
- Consumes: everything Task 6 consumes, plus `activityDays`, `questMeasure` and the `activity.reverted` event (Task 6).
- Produces: in `run.repository.ts`, `findRunById`, a session option on `updateRunFields`, `deleteRunById` returning `Run | null`. `updateRun` and `deleteRun` keep their signatures.

Use-case steps are the spec's "Training use cases" table: the edit reads the old run in the session before updating so the distance delta is exact. The runs page's delete `onSuccess` also invalidates `["user"]`.

- [ ] **Step 1: Write the failing tests** in `edit-delete-run.test.ts`:
  - `"edit applies the distance delta and recounts distance quests"`: log a 1 km run, edit to 2.5 km → `totalDistance === 2.5`, today's `daily_run_2km` `completed: true`, ledger `amount` equals the new `xpEarned`.
  - `"edit up past a new highest level levels up once"`: `leveledUp` via one `progression.leveled-up` row, `highestLevel` raised.
  - `"delete claws back a claimed daily quest"`: log a 3 km run, claim `daily_run_2km` with `claimQuest`, delete the run → quest unclaimed, `totalXp === 0`, `totalDistance === 0`, one `activity.reverted` row with `type: "run"`.
  - `"distance quests use the raw sum"` (Review Focus 5): runs this week of 10 km and 4.96 km, plus a 1 km run; delete the 1 km run → `weekly_run_15km` `progress === 14.96`, `completed: false`.
- In `item-route.test.ts`, replace `"DELETE does not change the user's XP or totals"` with `"DELETE reverses the run's XP and distance"` (same shape as Task 6's replacement, asserting `totalDistance` drops by the run's distance).
- [ ] **Step 2: Run** `npx vitest run src/server/training/runs src/app/api/runs` — expect the new tests to FAIL.
- [ ] **Step 3: Implement** the Produces list, the two use cases and the page invalidation.
- [ ] **Step 4: Run** `npm run test:run` and `npm run typecheck` — expect PASS.
- [ ] **Step 5: Commit** `feat(training): run edit and delete reconcile XP, distance, quests and streak`

[[Plans Index]]
