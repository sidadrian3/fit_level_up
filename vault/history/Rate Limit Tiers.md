# Rate Limit Tiers

**Type:** feature-api
**Areas:** infra, auth, workouts, runs, exercises, templates, quests, friends
**Surfaces:** api-only
**Pipeline outcome:** agentic
**Lane:** full

## Readiness at start

Assumptions: GETs stay unthrottled; no front-end handling of `Retry-After`; no key migration (old keys expire within an hour).
Riskiest part: a route test left on the old limiter mock would hit the fake Upstash URL, fail open and pass a 429 test wrongly.

## What was built

Two Upstash tiers (`standard` 30/min, `expensive` 10/h), one limiter per tier, keyed by route name and user. `defineRoute({ throttle })` requires a tier on every user mutation, and the route-table test enforces it. A 429 carries `Retry-After`, and a limiter error or timeout lets the request through with a log. The seven unlimited mutations now have a tier, `friends.request` is `expensive`, and the old shared 20-per-hour bucket is deleted.

## Decisions made

- The limiter is abuse protection, not an anti-XP-farming guard: logging stays `standard`, and fair XP belongs to the ledger (steps 3.1 and 3.5).
- GET routes stay unthrottled; heavy reads (`profile.records`, `runs.stats`, `friends.events`) are recorded as out of scope.
- `Retry-After` comes straight from Upstash's `reset`: a lower bound for the hour tier, because the sliding window does not expose the true wait.
- A timeout is logged as well as a thrown error, because the library resolves a timeout as `success: true` without a trace.
- `analytics` dropped: it added a Redis write per check and nothing reads the dashboard.
- Review follow-up: a test pins that the throttle runs before body parsing. The duplicated log line in `enforceThrottle` was left, since the two branches log different values.

## Verification

Escalations: none
UI verified: n/a (API only)
Handbook: Data Model And API Reference

## Notes

Step 2.4 (the `Idempotency-Key` header) builds on the same `defineRoute` pipeline. Throttling the heavy GETs would need no contract change, because `throttle` is already optional on any route.
