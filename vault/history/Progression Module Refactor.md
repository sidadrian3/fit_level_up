# Progression Module Refactor

**Type:** refactor
**Areas:** database, auth, workouts, runs, quests, friends, scripts, infra
**Surfaces:** api-only
**Pipeline outcome:** agentic

## Readiness at start

Preserved behavior covered by tests: mostly. log-workout, log-run, quest claim route, user-time-zone, friends and the rules tests existed; `/api/user` shape, a successful quest-claim XP grant and concurrent logging had no test, so Task 1 added characterization tests that passed on the old code first.
Assumptions: `lastActivityDay` is the `YYYY-MM-DD` slice of the old UTC-midnight `lastActivityDate`; the deploy-window gap between the build-time backfill and cutover is accepted.
Riskiest part: the level math changing from stored `level/xp` to a computed `totalXp` (the `calcLifetimeXp` and `levelFromTotalXp` round trip).

## What was refactored

Game state (XP, level, streak, stamina, totals) moved off better-auth's `user` document into `player_profiles`, owned by a new `src/server/progression` module. `grantUserXP` and `UserStateService.applyActivity` merged into one XP path behind `recordActivity` and `grantXp`, which write an `xp_ledger` row, `$inc` `totalXp` and emit `progression.leveled-up` through the outbox. The `__v` retry loops are gone. `xpToNextLevel` is computed. Migration 003 backfills profiles.

## Decisions made

- Progression reads only `player_profiles`; identity comes from `platform/auth` (`getAccount`, `getUserTimeZone`) and a legacy `getUser` in `lib/services/users` composes the `User` shape: keeps `/api/user` unchanged and progression free of identity fields.
- Writes read the profile inside the caller's transaction and make one `$inc`/`$set`; a concurrent transaction hits a write conflict and `withTransaction` reruns it: one concurrency mechanism instead of two, and no streak rule duplicated in Mongo expressions.
- `xp_ledger` written from day one (spec D4/C6), so step 3.5 only adds backfill and reversal.
- Migration 003 is expand-only: the old game fields stay on `user` until the 5.1 cleanup, so a Vercel instant rollback still finds its data. This means the user document is not yet reduced to auth fields.
- `timeZone` stays on the `user` document as an account setting (spec D7).
- Dashboard stats derive lifetime XP from level and xp inside the service, so callers pass the `User`.

## Verification

Escalations: none. Two plan gaps found and fixed during implementation: `createIndexes([])` throws in MongoDB (apply-schema now skips empty index lists), and the plan's "450 + 50 → level 1" example was wrong (500 XP is level 2).
UI verified: n/a (no UI change; `/api/user` shape pinned by a route test, minus `__v`).
Handbook: Data Model And API Reference, Domain Architecture, Architecture Review, Project Briefing, Developer SOP Guide, AGENTS.md

## Notes

- Tests: 302 before, 337 after. Every pre-existing `expect` value is unchanged; only setup (`seedPlayer`) and read-back moved.
- Reads of the time zone repeat inside the logging transaction (`getPlayerState`, `getUserTimeZone`, `recordActivity`). It is a cheap `_id` lookup; returning the zone from `PlayerState` would remove it.
- The code review's backfill off-by-one finding was rejected: the old writer stored the local day at UTC midnight, so slicing the Date gives the local day.
- Deploy-window gap: an activity logged on the old deploy between the build-time backfill and cutover will not reach the profile. Step 3.5's ledger backfill rebuilds XP from the activities.
- `GAME_CONFIG.stamina.dailyRecovery` is 100, so any stamina recovery test clamps to 100 and cannot tell recovery from a reset.

[[History Index]]
