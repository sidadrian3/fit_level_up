# Architecture Audit Phase 0 Fix

**Type:** fix
**Areas:** quests, achievements, friends, exercises, templates, auth, database, infra
**Surfaces:** api-only, cron
**Pipeline outcome:** agentic

## Readiness at start

Root cause: confirmed via 11 failing repro tests driving the real code paths
Assumptions: custom-exercise duplicates are decided on the formatted name; quest progress stays read-then-write inside the activity transaction
Riskiest part: the pre-index migration that dedupes existing rows before unique indexes build

## What was fixed

Audit steps 0.1–0.6 as one PR (F-1, F-2, F-3, F-5, F-6, F-7, F-12, F-13, F-14). Rule violations and forbidden friend actions return 4xx, malformed ids return 404, the exercise route validates and rate-limits, the cron route and `/templates` are protected, concurrent creates cannot duplicate rows, quest progress is credited without a prior sync, and a declined friend request can be re-sent. Step 0.7 (time zone, F-8) and F-4 are separate.

## Root cause

Invariants that each caller had to remember (an error type, an id guard, validation, a uniqueness check) instead of the database or types enforcing them. See [[Architecture Audit Phase 0 Fix Plan]] for the per-finding table.

## Decisions made

- `DomainError` lives in `lib/domain` with `kind` invalid or conflict: the domain layer may not import `lib/api`, and `handleApiError` maps it, so step 2.2 reuses it.
- Custom-exercise unique key is the formatted name, not a new `nameLower` field: names are already canonical.
- Friendships are one document per unordered pair (`pairKey`); re-requesting after a decline reopens the same document atomically.
- Quest progress uses upsert, read, `calcNextProgress`, write inside the transaction, with `session` required so the safety cannot be skipped.
- Template idempotency moved from the data layer to the service, matching `logWorkout`.
- Immediate re-request after a decline is allowed; the spam risk is a Known Issues entry.
- `CRON_SECRET` is required in `env.ts`, and `vercel.json` schedules the sweep daily at 03:00 UTC.
- The data layer returns `null` for a missing user and the service throws, so `lib/data` never imports `lib/api`.

## Verification

Escalations: none
UI verified: n/a (api-only)
Handbook: Data Model And API Reference, Developer SOP Guide, Domain Architecture, Project Briefing, Guides Index, Known Issues

## Notes

- `user_quests` became unique, which the original plan did not include (see the plan); it went against the "keep old indexes until step 2.1" decision and was flagged for review.
- `sendFriendRequest` also matches a duplicate on `requesterId`, because the older `(requesterId, receiverId)` index fires before `pairKey` for same-direction repeats. Remove that branch when step 2.1 drops the old index.
- Left as is: exercise 429 responses are still hand-formatted like the other routes (step 2.3 centralises rate limiting), and the cron bearer comparison is not constant-time.
- `prepareUniqueIndexes` deletes duplicate rows on every build; it is idempotent but destructive on first run in an environment with duplicates.
[[History Index]]
