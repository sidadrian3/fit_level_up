# Transactional Outbox

**Type:** feature-api
**Areas:** infra, database, workouts, runs, quests, achievements, friends, scripts
**Surfaces:** api-only, cron
**Pipeline outcome:** agentic
**Lane:** full

## Readiness at start

Assumptions: the friend level-up fan-out keeps calling the Redis SSE publisher and stays non-idempotent until the notification inbox (3.8) replaces it; achievements missed before the deploy lose the old sweep's safety net, which is acceptable because production is mostly test accounts.
Riskiest part: delivering a row exactly once in effect when a function can die between a listener succeeding and the row being marked done.

## What was built

`src/server/platform/events` provides a typed `emit()` that writes an `outbox` row in the caller's transaction and a dispatcher that claims rows atomically with a lease, retries only the listeners that have not succeeded, backs off, and marks a row `dead` after eight attempts. `defineRoute` delivers the ids a request emitted through `after()`, `/api/cron/outbox-sweep` replaces the achievements sweep, and `npm run outbox` lists and requeues dead rows. Level-up fan-out and achievement evaluation now run as outbox listeners.

## Decisions made

- Achievement evaluation listens to both `activity.logged` and `progression.leveled-up`: a quest-claim level-up logs no activity, and the deleted sweep was the only thing that caught it.
- The level-up listener stays non-idempotent: a Redis dedupe key would be deleted by step 3.8, so one rare duplicate toast is accepted.
- `OutboxDoc` is generic in `schema.ts`: importing `EventMap` there makes a database to events cycle.
- Listener names are unique per event type, not globally, so one `achievements.evaluate` can serve two events.
- `session` is required on `applyActivity` and `grantUserXP`, which made their sessionless retry loops dead code.
- The dispatcher's finish writes filter on `attempts`, so a worker whose lease expired cannot overwrite the worker that reclaimed the row.

## Verification

Escalations: none. One sub-agent skipped the red step of TDD for the `defineRoute` tests; the coordinator reverted the new implementation and confirmed the two dispatch tests fail without it. One sub-agent reformatted two files with prettier; the coordinator restored them and reapplied only the real change.
UI verified: n/a (API only)
Handbook: Data Model And API Reference, Domain Architecture, Developer SOP Guide, Architecture Review, Project Briefing

## Notes

- `lastError` is not cleared when a later attempt succeeds, so a `done` row can still show an old error.
- The duplicated `OptimisticLockError` relabel in `grant-user-xp.ts` and `user-state.service.ts` was left alone: step 3.1 removes `__v` and both blocks.
- `drainUntilEmpty` measures its budget with `Date.now()`, not the injected clock.
