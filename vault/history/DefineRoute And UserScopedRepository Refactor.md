# DefineRoute And UserScopedRepository Refactor

**Type:** refactor
**Areas:** infra, auth, database, workouts, runs, exercises, templates, quests, achievements, friends
**Surfaces:** api-only
**Pipeline outcome:** agentic

## Readiness at start

Preserved behavior covered by tests: partial, with route tests for workouts POST, runs POST, exercises POST, quest claim, template DELETE and the cron sweep; the hand-written 404 bodies in `runs/[id]` and `workouts/[id]` and list pagination were not covered, so Task 1 added characterization tests first
Assumptions: the audit §8.3 kickoff prompt for 2.2 is authoritative; event scope, `after()` dispatch and the Idempotency-Key header wait for 2.5 and 2.4
Riskiest part: the route tests mock `@/lib/auth/auth-helpers` and `@/lib/auth/rate-limit`, so `defineRoute` had to reach auth and the limiter through those modules or the tests would hit real better-auth and Upstash

## What was refactored

Audit step 2.2 ([[DefineRoute And UserScopedRepository Plan]], issue #24). Every route under `src/app/api` except `auth/[...all]` is built with `defineRoute` from `@/server/runtime`: auth (`user`, `cron`, `public`), the rate limit, params/query/body parsing and error mapping live in `src/server/platform/http`, and no route file contains `try/catch` or calls `getAuthUserId`. A route-table test fails when a route is not built with `defineRoute`, when a user mutation does not state `body` and `throttle`, when a cron or public route is throttled, or when two routes share a name. `userScopedRepository<T>` was added to `platform/database`, and `workout-templates-db.ts` is its first caller. The AppError family, `parseObjectId` and `isDuplicateKeyError` moved into the platform; `src/lib/api/` is gone.

## Decisions made

- Mutations not rate-limited today declare `throttle: null`: the route-table test can then tell a forgotten setting from a deliberate one, and step 2.3 removes `null` so those seven routes become compile errors to fix.
- `ThrottleTier` is `"standard"` only, mapped to today's limiter exactly (20 per hour, keyed by user id alone, on the same seven routes). Two tiers is the smallest design that fixes F-11 and protects friend requests, so 2.3 keeps them.
- Auth and the limiter are injected into `createDefineRoute` from `runtime.ts`, using the lib functions the route tests already mock. The session logic itself moved to `platform/auth` as `getSessionUserId`, and `getAuthUserId` wraps it.
- The template list is capped at the repository's find maximum (200), because the contract requires a limit.
- Malformed JSON is caught at the body read as a `BadRequestError`, not by mapping every `SyntaxError`, so an unrelated `JSON.parse` bug in a service is not turned into a 400.
- The SSE stream builder moved to `src/lib/sse/friend-event-stream.ts`; its inner `try/catch` detects a closed stream and is not error mapping.
- No re-export shims: importers of moved helpers were retargeted directly.

## Verification

Escalations: none; all nine tasks were delegated to fresh sub-agents with no plan-wrong signal. One sub-agent note: handlers must return a Promise, so two sync handlers were written `async`
UI verified: n/a (API only)
Handbook: Data Model And API Reference, Domain Architecture, Architecture Review, Project Briefing
Code review: Spec found no gaps, and no observable change beyond the allowed ones. Standards found no hard violations. Five findings were fixed in `0411f32`: `$rename` onto `userId` bypassed the owner guard, `aggregate` accepted `$lookup`/`$unionWith`/`$out`/`$merge`/`$graphLookup` stages (including inside `$facet`), `paginate` accepted a page below 1, comments restating code in the moved SSE file, and the route-table test accepted `body: undefined` and would pass with no routes found. Pushed back: the 200 cap and `throttle: null` (decided with the user), the full repository interface with one caller (the plan scopes the whole C3 contract), the one-member `ThrottleTier` (2.3 extends it), `BSONError` mapped to 404 (spec C2 backstop), and the type casts in `define-route.ts` (sound for the generic defaults).

Route-table proof (temporary edits, reverted, not committed):

- Removing `throttle: null` from `quests/[id]/claim`: `POST /api/quests/[id]/claim: user mutation must state "throttle"`
- Renaming `runs.stats` to `runs.list`: `runs.list: GET /api/runs, GET /api/runs/stats`

## Notes

- Repeated query parameters changed: `?limit=1&limit=2` used to read the first value and now reads the last (`Object.fromEntries`). Nothing in the client sends repeated parameters.
- `vault/Workout Templates Anatomy.md` still shows the pre-2.2 route and an old data-layer snippet. It was already out of date before this step (it predates the data-bypass fix), so it was left for a guide-wide rewrite.
- `AGENTS.md` still describes `getAuthUserId`, `handleApiError` and `RateLimit` in the route layer rules; step 5.1 rewrites it.
- `userScopedRepository` has one production caller, so `findById`, `updateById`, `updateOne`, `upsertMany`, `count`, `paginate` and `aggregate` are covered only by their own tests until the Phase 3 modules adopt them.
- Next: 2.3 replaces `limit` in `runtime.ts` with the tiered limiter and removes `throttle: null`; 2.4 adds the Idempotency-Key header; 2.5 adds event dispatch to `defineRoute`.
- Plan: [[DefineRoute And UserScopedRepository Plan]]. Spec: [[Architecture Overhaul Design Spec]].

[[History Index]]
