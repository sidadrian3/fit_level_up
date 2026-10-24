# Quests And Training Modules Plan

> **For agentic workers:** each task below is one commit. Run `npx eslint <changed files> && npm run typecheck && npm run test:run` before handing a task back; the coordinator reviews and commits. Steps use checkbox (`- [ ]`) syntax for tracking.

**Steps:** 3.2, 3.3 and 3.4 in [[Architecture Overhaul Audit]] (§5.3 game content, F-9, F-17), on one branch, `refactor/quests-and-training-modules`, in that order. **Spec:** [[Architecture Overhaul Design Spec]] D5, D6c. **Baseline:** 337 tests in 50 files, all green.

### Thought Process

**Core technical challenge.** Three moves share one branch and depend on each other: the quest module cannot be written until quest definitions stop being database rows (3.2 → 3.3), and training cannot move until it can call the quests module (3.3 → 3.4). The risky part is not the file moves but the data changes that ride along: `user_quests.questTemplateId` changes from an ObjectId string to a string id, and all-time quests change from `"all-time"` to `null` in both period fields. A $jsonSchema validator, a unique index and a build-time migration all touch the same collection, so their order matters.

**Edge cases.**
- *Migration ordering.* `migrate-db.ts` runs migrations first and `applySchema` second. The userQuests validator currently requires `periodStart` and `periodEnd` to be strings, so a migration that writes `null` while the old validator is active fails (`validationAction: "error"`). The migration must loosen the validator itself (a `collMod`) before it rewrites rows, and `schema.ts` carries the nullable validator for every later `applySchema`.
- *Unique index across the remap.* Rows are matched by `(userId, questTemplateId, periodStart, periodEnd)`. After the id remap two rows could collide (a row already written with the new id by the new code, and an old row for the same period). The migration upserts-or-drops: if the target key already exists, the old row is deleted rather than renamed. Rerunning is a no-op.
- *Null in a unique index.* MongoDB treats null as one value, so there is still exactly one all-time row per user and quest. A missing field is also null, so the migration writes explicit nulls.
- *Old instances during a deploy.* Between the build-time migration and cutover, the previous deploy still serves traffic and can write an ObjectId-style row. Accepted (decided in grilling): a rerun of the idempotent migration at the next deploy heals it.
- *Unknown template ids.* A `user_quests` row whose template no longer exists (or whose title is not one of the five seeded titles) is dropped, never guessed. It was already invisible: `getUserQuests` skips rows with no template.
- *Race and retry.* `updateQuestProgress` and `claim` stay inside a transaction with the `session` passed to every repository call. The claim marks `claimed: false → true` with a filtered `updateOne` before granting XP, as it does today, so a double claim still returns 409.
- *Activity dates.* `date` changes from `"YYYY-MM-DD"` (UTC slice) to an ISO instant. Every consumer of `Workout.date` / `Run.date` must format through one helper that takes the user's time zone, or a card would show the browser's zone while the streak uses the profile's zone.
- *Update/delete.* Both gain a use case in the module, but XP/quest reversal is explicitly step 3.5. The tests pin "delete does not change XP" so 3.5 changes it on purpose.
- *Friends.* `getFriends` reads every friend's full history through `workout-db` and `runs-db`. Those move, so friends calls training's `getPersonalRecords(userId)` through `index.ts`. Same output; the N+1 over friends is 3.7.

**Impact on existing architecture.** Adds `src/server/quests/` and `src/server/training/` as modules with one public `index.ts` each, plus a definitions-only `src/server/achievements/`. The ESLint entry-only rule already blocks deep imports, and `*.rules.ts` files already may not import I/O. `lib/services/{quests,workouts,runs,exercises,workout-templates,users/get-dashboard-stats}`, `lib/data/{quests,workout,runs,custom-exercises,workout-templates}-db.ts` and the matching domain files are emptied; the folders themselves are deleted in 5.1. The `npm run seed` script and the `quest_templates` and `achievements` collections stop being used.

## Problem Statement

Quest and achievement rules are game content, but they live in two seeded database collections. Seed drift is possible (the seed runs by hand), quest template ids are ObjectIds that crash lookups when malformed, and every quest sync, progress update and achievement check pays a database read for data that changes only in a pull request. The all-time quest uses the string `"all-time"` in a date field, so every date comparison special-cases it.

Quests and training are still spread across `lib/services`, `lib/data` and `lib/domain`. Deletes go from the route straight to the database layer. Personal records, run stats and the dashboard load a user's entire history to compute a handful of numbers. `calcMuscleVolume` reads the clock, and activity cards show the UTC day, so a 7 AM workout in Manila shows as yesterday.

## Solution

Quest and achievement definitions become typed `as const` tables with stable string ids. A `quests` module owns sync, progress, list and claim, with a pure rules file, a repository on `UserScopedRepository`, and a public `index.ts`. A `training` module owns workouts, runs, templates, custom exercises and records, one folder per use case. Update and delete go through the module. Records, run stats and the dashboard read through database aggregation or bounded queries. The muscle heatmap calculation takes `now` and moves to `src/shared/` because the browser runs it. Workout and run responses return the activity instant, formatted client-side in the user's time zone.

## Commits

Every task keeps all 337 existing tests green; each phase ends green with lint, typecheck and tests.

### Phase 0: Characterization tests (passing on the old code)

#### Task 1: Pin the uncovered behaviour

- [ ] `GET /api/quests` route test: sync creates the period's rows for the seeded definitions, the response is `Quest[]` with the exact key set (`id, title, description, category, progress, target, xpReward, completed, claimed, icon`), an all-time or special quest is returned, and a row from a past period is excluded.
- [ ] `GET /api/achievements` route test: all five definitions returned with `unlocked` and `unlockedDate` populated for an unlocked one.
- [ ] `GET /api/profile/records` route test: top three lifts by max weight per case-insensitive name, original casing of the heaviest set, fastest 5K / 10K inside the distance windows, longest run; empty history returns `[]`.
- [ ] `GET /api/runs/stats` route test: `totalKm` (1 decimal), `totalRuns`, `avgPace` (2 decimals), and the empty case.
- [ ] Dashboard stats test: week boundaries use the user's time zone (a Manila Sunday-night workout counts in the right week), `lifetimeXP`, `totalAchievements`.
- [ ] Workout and run update/delete route tests: PUT recomputes `xpEarned` and keeps the original date, 404 on a malformed or foreign id, DELETE removes only the owner's row, and delete does **not** change the user's XP or totals (pins current behaviour for 3.5).
- [ ] Custom exercise and template tests already exist; no change.

Commit: `test(quests,training): characterize quest, records, stats and update/delete behaviour`.

### Phase 1: Step 3.2, game content in code

#### Task 2: Definitions as constants

- [ ] `src/server/quests/quest.definitions.ts`: the five quests as an `as const` table with ids `daily_workout_1`, `daily_run_2km`, `weekly_workouts_3`, `weekly_run_15km`, `weekend_run_1`, each with title, description, category, metric, target, xpReward, icon. Export `QUEST_DEFINITIONS`, `QuestId`, and a lookup by id. Keep the seeded titles on a private `legacyTitle` field for the migration, and delete it with the 5.1 cleanup.
- [ ] `src/server/achievements/achievement.definitions.ts` and `index.ts`: the five achievements with their existing string ids, plus `ACHIEVEMENT_DEFINITIONS` and the `AchievementCondition` type moved from `lib/domain/achievement-rules.ts`. `isConditionMet` stays where it is until 3.6.
- [ ] Unit test (branching logic only): every definition id is unique, every quest `legacyTitle` is unique, and every metric is one the progress handlers know.

Commit: `refactor(quests): quest and achievement definitions as typed constants`.

#### Task 3: Read definitions from code, migrate rows

- [ ] Migration `004-quest-ids-and-all-time-periods.ts`, idempotent: (a) `collMod` the `user_quests` validator to allow null periods; (b) read `quest_templates` (ObjectId → title), map to the new id by `legacyTitle`; (c) for each `user_quests` row with an ObjectId-style `questTemplateId`, rewrite it, or delete the row if the title is unknown or the target key already exists; (d) set `periodStart` and `periodEnd` to `null` where they are `"all-time"`. Register it in `migrations/index.ts`.
- [ ] `schema.ts`: nullable period validator, `UserQuestDoc.periodStart/periodEnd: string | null`, and remove the `questTemplates` index set. The old collections stay in `COLLECTIONS` (expand-only, dropped in 5.1).
- [ ] Switch the quest services and `getAllAchievementsForUser` / `evaluateAchievements` to the definitions; the "active quests" query becomes `periodEnd >= today OR periodEnd null`. `getPeriodForCategory` returns `null` periods for the special/all-time category.
- [ ] Migration integration test against the replica set: seed old-style templates and rows (ObjectId ids, `"all-time"`), run twice, assert remapped ids, nulls, unknown rows dropped, no duplicates, second run is a no-op.
- [ ] Delete `seed-quests.ts`, `seed-achievements.ts` and the `seed` script from `package.json`; remove the seed instructions from the docs in the handbook sync step.

Commit: `refactor(quests): migrate quest ids and all-time periods, retire seed scripts`.

### Phase 2: Step 3.3, `quests` module

#### Task 4: Quest rules and repository

- [ ] `quest.rules.ts`: move `getPeriodForCategory`, `calcNextProgress`, `validateQuestClaim`, `getQuestProgressUpdates` from `lib/domain/quest-rules.ts`; move the existing `quest-rules.test.ts` with them. `QuestCalendar { now, timeZone }` lives here.
- [ ] `quest.repository.ts` on `userScopedRepository<UserQuestDoc & UserOwnedDoc>("userQuests")`: find active for a day, find by id, bulk upsert of the period's rows, set progress, mark claimed (`claimed: false` filter, returns whether it changed).

Commit: `refactor(quests): quest rules and user-scoped repository`.

#### Task 5: Use cases and public API

- [ ] `sync-quests.ts`, `get-quests.ts`, `update-quest-progress.ts` (session required), `claim-quest.ts` (calls `grantXp` in the same transaction), each moved from `lib/services/quests` with the same behaviour, now reading definitions instead of templates. `toQuestView` lives in `get-quests.ts`.
- [ ] `index.ts` exports `getQuests`, `claimQuest`, `updateQuestProgress`, `QuestCalendar`. Routes `GET /api/quests` and `POST /api/quests/[id]/claim`, the dashboard page and the workout/run services import from `@/server/quests`.
- [ ] Move `update-quest-progress.test.ts` next to the module; the claim route test stays.
- [ ] Delete `lib/services/quests/*`, `lib/data/quests-db.ts`, `lib/domain/quest-rules.ts`.

Commit: `refactor(quests): quests module with sync, progress, list and claim`.

### Phase 3: Step 3.4, `training` module

#### Task 6: Pure rules

- [ ] `workouts/workout.rules.ts` (from `workout-rules.ts` + `workout-evaluator.ts`), `runs/run.rules.ts` (from `run-rules.ts` + `run-evaluator.ts`), `exercises/exercise.rules.ts`, moved with their tests. Stamina rules already live with progression; import them from its `index.ts` if exported, otherwise leave `stamina-rules.ts` where it is and note it.
- [ ] `src/shared/muscle-volume.ts`: `calcMuscleVolume(workouts, days, now)` takes `now`; `MuscleHeatmap` passes `new Date()`; `muscle-evaluator.test.ts` moves with it and uses a fixed `now` instead of fake timers. The component still gets `Workout[]` from the existing list endpoint.
- [ ] `records/records.rules.ts`: `calculatePersonalRecords` becomes `buildPersonalRecords(...)` over pre-aggregated rows (see Task 8), plus the run stats formatter. `formatDuration` is imported from `shared`.

Commit: `refactor(training): pure workout, run, exercise and records rules`.

#### Task 7: Repositories

- [ ] `workout.repository.ts`, `run.repository.ts`, `template.repository.ts`, `custom-exercise.repository.ts` on `userScopedRepository`, with the existing queries (paginate, insert, update, delete by id, count and sum in a range, idempotency lookups, dates in a range). Documents map to domain types here and `date` is returned as an ISO instant (`doc.date.toISOString()`).
- [ ] `schema.ts`: nothing new; the `(userId, date)` indexes already cover every query below.

Commit: `refactor(training): user-scoped repositories for workouts, runs, templates, exercises`.

#### Task 8: Use cases, aggregations and public API

- [ ] Move `log-workout`, `update-workout`, `log-run`, `update-run`, `create-workout-template`, `create-custom-exercise`, `get-custom-exercises` into their folders. Add `delete-workout`, `delete-run`, `delete-template` use cases (moving the route-to-database calls into the module); none touches XP, quests or totals.
- [ ] `records/get-personal-records.ts`: aggregation pipelines on workouts (`$match userId` → `$unwind exercises` → weight > 0 → `$group` by lowercased trimmed name with `$max` weight and the display name of the heaviest set → `$sort` → `$limit 3`) and on runs (longest by distance, fastest in the 5K and 10K windows by duration, each a sort+limit-1 query); output identical to today.
- [ ] `records/get-run-stats.ts`: one `$group` over the user's runs (sum distance, count, average pace) with the same rounding.
- [ ] `get-dashboard-stats.ts` moves into training; recent workouts become a bounded query of 3 (`getRecentWorkouts`).
- [ ] `index.ts` exports the use cases, `getPersonalRecords`, `getRunStats`, `getDashboardStats`, `getRecentWorkouts`, `getWorkoutDatesInRange`, and the list queries. The `activity.logged` event interface stays in `events.ts`.
- [ ] Routes, `dashboard/page.tsx`, `profile/page.tsx`, and `get-friends.ts` import only from `@/server/training`; friends calls `getPersonalRecords(friendId)` instead of loading history. Workout, run and template DELETE routes call the new use cases.
- [ ] Move service tests (`log-workout`, `log-run`, `create-custom-exercise`, `create-workout-template`, `get-custom-exercises`, `get-dashboard-stats`) next to their use case. Delete the old `lib/services`, `lib/data` and `lib/domain` files and `lib/utils/records.ts`.

Commit: `refactor(training): training module with aggregated records, stats and delete use cases`.

#### Task 9: Dates as instants

- [ ] `Workout.date` and `Run.date` are ISO instants. `formatDate(isoInstant, timeZone)` in `formatters.ts` formats in the user's zone, and every workout/run card passes `user.timeZone` (from the existing user query). Update the contract types and the route tests' expected `date` values (old and new). A test pins "a 23:30 UTC workout for a Manila user renders as the next local day".

Commit: `refactor(training): return activity instants, format dates in the user's time zone`.

### Phase 4: Wrap-up

#### Task 10: Docs

- [ ] Step 5b handbook sync per the pipeline (Data Model And API Reference §2–§4, Domain Architecture, Architecture Review, Project Briefing, Developer SOP Guide for the removed seed script, `AGENTS.md` layout), and mark 3.2–3.4 Done in the audit's step table.

Commit: `docs(vault): update handbook for quests and training modules`.

## Decision Document

- Quest and achievement definitions are `as const` tables with stable string ids (D6c). Quest definitions live with the quests module. Achievement definitions live in `src/server/achievements/` (definitions only, exported through `index.ts`) until step 3.6 moves the evaluation logic in.
- All-time quests store `periodStart: null` and `periodEnd: null`. The unique index is unchanged and still allows one all-time row per user and quest.
- `questTemplateId` is rewritten in place by an idempotent migration that maps old templates by seeded title; unknown rows are dropped. The old `quest_templates` and `achievements` collections stay until the 5.1 cleanup (expand-only). A previous-deploy instance may write one stale row in the window; the next migration run heals it.
- Quests: `index.ts` is the only import path. Claim marks the row claimed and calls `grantXp` in one transaction. `updateQuestProgress` still requires a session. `QuestCalendar { now, timeZone }` is kept.
- Training: one folder per use case. Update and delete live in the module with no XP or quest reversal (3.5). Records and run stats use database aggregation on the existing data; no `nameLower` field or index.
- The muscle heatmap calculation stays a browser calculation: it moves to `src/shared/`, takes `now`, and keeps its existing 30-workout input.
- Activity dates are returned as ISO instants and formatted in the user's time zone on the client.
- Pages and friends read through module `index.ts` only. `getFriends` uses `getPersonalRecords`; the friends N+1 stays for 3.7.
- Cross-module calls are direct and share the caller's transaction: training → quests and training → progression for logging; quests → progression for claims.
- `npm run seed` and both seed scripts are deleted.

## Testing Decisions

A good test here asserts what a caller sees: an HTTP response, a stored document, the XP a user ends up with. It does not assert which function was called.

- **Integration first.** Each use case is tested through its service or route against the in-memory replica set (prior art: `log-workout.test.ts`, `update-quest-progress.test.ts`, `quests/__tests__/claim.test.ts`). Task 1 adds the missing characterization tests before any move, and they must pass on the old code.
- **Migration test** for `004` (prior art: `migrations/__tests__`), run twice to prove idempotency.
- **Unit tests only where there is branching:** the definition table integrity check, quest and workout/run rules, the muscle volume intensity thresholds, personal-record windows. Existing rule tests move with their files; no new unit test for pass-through code.
- Mock only external boundaries (Upstash, the clock). No mocked repositories.
- Every task runs `npx eslint`, `npm run typecheck` and `npm run test:run` before handback.

## Out of Scope

- The `achievements` module and its outbox listener (3.6), including `evaluateAchievements` and `isConditionMet`.
- Edit and delete XP, level, totals and quest reconciliation, and the ledger backfill (3.5).
- `social` and the friends N+1 (3.7), notifications (3.8).
- Front-end query-key and hook ownership, `WorkoutForm` split and the heatmap's 30-workout cap (Phase 4).
- Dropping the old collections, the old `lib/` folders and the legacy title field (5.1).
- Adding any new endpoint.

## Further Notes

- The riskiest part is migration 004: the validator `collMod`, the id remap and the unique index must hold when the migration runs twice and when the new code has already created rows with the new ids.
- If `stamina-rules.ts` is not exported from progression's `index.ts`, the evaluators in Task 6 need either an export or a copy; prefer exporting the two functions rather than duplicating them.
- Production `user_quests` rows with the five seeded titles are assumed. If a title was edited by hand in production, those rows are dropped and the quest restarts for that period; check `quest_templates` titles before the deploy.

[[Plans Index]]
