# Architecture Overhaul Design Spec

**Type:** feature-api
**Areas:** infra, database, auth, achievements, friends, quests, workouts, runs
**Surfaces:** api-only, cron
**Pipeline outcome:** manual
**Lane:** full

## Readiness at start

Assumptions: preview deploys don't share the production database; the production custom-exercises collection is `customExercises`; the Upstash limiter's `timeout` lets a slow Redis through; rate-limit numbers, the 30 s poll, the 90-day notification expiry and the outbox tuning are tunable config; the two step-2.5 listeners wrap old services, and the Redis one can double a toast until 3.8
Riskiest part: build-time migrations could touch production data if previews share its database

## What was built

Spec only (audit step 1.1): [[Architecture Overhaul Design Spec]] settles every audit §7.2 question and fixes the contracts Phases 2–3 build on: `defineRoute`, `UserScopedRepository<T>`, the event map, outbox, ledger and notification documents, `schema.ts` and the `runtime.ts` composition root. No code changed. The pipeline stopped after the readiness check, because steps 2.1 onward each run their own pipeline and plan.

## Decisions made

- Vercel Hobby stays (cron at most daily), and production holds mostly test accounts: these two facts drove the outbox drain design and the no-dual-read migration approach.
- Polling an inbox replaces SSE: on Hobby, SSE reconnects every ~60 s and polls Mongo internally anyway. A hosted push service is the recorded scale exit.
- The outbox drain follows the events, not the traffic. A request delivers only the rows it emitted (by id) plus at most 3 overdue ones; a request that emitted nothing does no outbox query. This was revised after the user challenged a global drain on every mutation and poll for scale.
- Dead outbox rows never expire; `npm run outbox` lists and requeues them. No alerting.
- ESLint for file-level boundary rules (editor feedback) plus dependency-cruiser for graph rules (cycles, who imports whom); no rule lives in both.
- `$jsonSchema` validators reject bad writes (`error`, `moderate`); the test setup applies them, so the suite catches type/validator drift.
- `timeZone` stays on the better-auth `user` document as an account setting.
- New `src/shared/` area: the audit's placement of Zod schemas under server-only `src/server/` was impossible, because client forms import them.
- Listeners are wired explicitly in `src/server/runtime.ts` rather than through `instrumentation.ts`, so a missed registration cannot fail silently.
- The ledger write path moves into step 3.1 (`grantXp`/`recordActivity` take a source); 3.5 keeps the backfill and the reversal. Module order unchanged.

## Verification

Escalations: none
UI verified: n/a (spec only)
Handbook: no update needed — docs-only change; [[Architecture Overhaul Audit]] §6, §7.2 and §8 were updated to point at the spec

## Notes

- Step 3.5's brainstorm still owns the edit/delete edge cases (unlocked achievements, claimed quests, level-down notice).
- better-auth's own endpoint rate limiting (per-instance memory on serverless) is an unscheduled security follow-up.
- AGENTS.md rules that change (document types in `schema.ts`, contracts in `src/shared/`) are rewritten in step 5.1, not before.

[[History Index]]
