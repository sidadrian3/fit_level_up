# Quests And Training Modules Refactor

**Type:** refactor
**Areas:** quests, achievements, workouts, runs, templates, exercises, stats, profile, database, friends, infra
**Surfaces:** ui, api-only
**Pipeline outcome:** agentic

## Readiness at start

Preserved behavior covered by tests: mostly. Quest claim, quest progress, workout and run logging, templates, custom exercises and the rules existed; `GET /api/quests`, `GET /api/achievements`, profile records, run stats, dashboard week boundaries and workout/run update and delete had no tests, so Task 1 added 27 characterization tests that passed on the old code first.
Assumptions: existing `user_quests` rows map to the new quest ids by the five seeded template titles; unknown rows are dropped; the old `quest_templates` and `achievements` collections stay until 5.1.
Riskiest part: migration 004 (id remap, nullable validator and `null` periods against the unique index).

## What was refactored

Steps 3.2, 3.3 and 3.4 of the architecture overhaul on one branch. Quest and achievement definitions became typed constants (`QUEST_DEFINITIONS`, `ACHIEVEMENT_DEFINITIONS`), migration 004 rewrote `user_quests` to string quest ids and `null` all-time periods, and the seed scripts and `npm run seed` were deleted. `src/server/quests` now owns sync, progress, list and claim. `src/server/training` owns workouts, runs, templates, custom exercises and records, with user-scoped repositories, delete use cases in the module, and personal records and run stats computed by aggregation. Workout and run dates are now returned as ISO instants and formatted in the user's time zone by the client.

## Decisions made

- All-time quests store `null` for both `periodStart` and `periodEnd`: no sentinel string is left in date fields, and the unique index still allows one row per user and quest.
- `questTemplateId` is rewritten in place rather than dual-written: the deploy window is short and the migration is rerunnable, and a dual field would have meant a second unique index until 5.1.
- Records use aggregation on the existing data, with no `nameLower` field or index: the top-3 query groups across every exercise name, so that index would not have helped it.
- The muscle heatmap stays a browser calculation in `src/shared/muscle-volume.ts` taking `now`: moving it to the server would have been a new endpoint, which is not a refactor.
- Achievement definitions live in `src/server/achievements` (definitions only) so 3.6 moves the evaluation logic in without moving the data again.
- Activity dates return the instant and are formatted in the client with `formatActivityDate(iso, timeZone)`; `formatDate` stays for the date-only `joinDate`. Until the user loads, the formatter reads as UTC, matching how the server treats an unset zone.
- Tasks 7–8 of the plan were re-sliced into vertical slices (templates and exercises, then workouts and runs, then records) because repositories built first would have left the unbounded history reads without a repository to call.
- Migration 004 stops the build when legacy rows exist but no template maps to a definition, instead of deleting them.

## Verification

Escalations: none. One pre-commit dependency check failure on the rules commit (`src/shared` imported from `lib`), fixed by giving the shared helpers structural types; one stray `vault/Architecture Overhaul Audit.md-E` backup file (from `sed -i -E` on macOS) was committed by mistake and removed after review.
UI verified: not run in a browser; the three activity cards are covered by the `formatActivityDate` unit test and the route tests only.
Handbook: Data Model And API Reference, Domain Architecture, Architecture Review, Project Briefing, Developer SOP Guide, Workout Templates Anatomy, AGENTS.md

## Notes

- Tests: 337 before, 387 after. Every pre-existing expectation is unchanged except the `date` values of the PUT "keeps the original date" tests (now ISO instants) and the two evaluator tests, which now run against the real rules instead of mocks (values recomputed from `GAME_CONFIG`).
- `findLiftMaxes` uses `$top` in `$group`, which needs MongoDB 5.2 or later; the test server satisfies it, and the production Atlas version was not checked.
- `getCustomExercises` and `findActiveQuests` now cap at `MAX_FIND_LIMIT` (200) because the user-scoped repository requires a limit; templates already had the cap. Nothing paginates or warns when a user passes 200 custom exercises.
- `getFriends` still runs several queries per friend through `getPersonalRecords`; the loop is step 3.7's job.
- `claimQuest` marks a row claimed and grants nothing when its quest id is not in the definitions, the same as the old missing-template behaviour; the migration drops such rows.
- `stamina-rules.ts` stayed in `src/lib/domain` because progression does not export it; `records.rules.ts` still imports `formatDuration` from `lib/utils/formatters` (not yet in `shared`).
- Production deploy: check that `quest_templates` still holds the five seeded titles before the migration runs, or the quest rows for edited titles are dropped.

[[History Index]]
