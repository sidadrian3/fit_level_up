# Old Lib Removal Refactor

**Type:** refactor
**Areas:** auth, progression, stats, workouts, runs, tooling
**Surfaces:** ui, api-only
**Pipeline outcome:** agentic

## Readiness at start

Preserved behavior covered by tests: yes, by the stamina and active-days unit tests, the 16 route tests, `get-dashboard-stats` and the Playwright journey (464 tests green at the base commit).
Assumptions: the achievements seed comments and `sse-registry` were already gone (steps 3.2 and 3.8); `lib/auth/client.ts` is browser code and stays.
Riskiest part: repointing the route-test auth mocks to a partial mock of `platform/auth` without stubbing its real exports.

## What was refactored

The last old `src/lib` back-end pieces moved to the modules that own them and `lib/{services,domain,auth-helpers}` were deleted: `getUser` into progression, `getAuthUserId` into `platform/auth` as `requireSessionUserId`, the stamina cost rules into `training/stamina.rules.ts`, and `calcActiveDays` into `training/stats` behind a new `getActiveDaysThisWeek` read service. Dependency-cruiser G3 lost its strangler exemption. AGENTS.md, README and the guides now describe `src/server` only, and Architecture Review is marked superseded by the design spec.

## Decisions made

- `getUser` lives in progression: most of `User` is player state and progression already reads the account for the time zone. No new module.
- `requireSessionUserId` pairs with `getSessionUserId`; the name says which one throws.
- Stamina cost rules live in training, not progression, so training's pure rules do not import another module's index.
- The dashboard page calls a stats read service instead of running a rule; `getWorkoutDatesInRange` left training's public API.
- The `proxy.ts` session round trip (F-18) stayed out: it changes runtime behaviour, so it is logged in Known Issues.

## Verification

Escalations: none
UI verified: Playwright journey (4 tests), which renders the dashboard and profile pages.
Handbook: Domain Architecture, Developer Handbook, Developer SOP Guide, Project Briefing, Workout Templates Anatomy, Guides Index, Architecture Review (superseded banner), Known Issues, Architecture Overhaul Audit (F-18), README, AGENTS.md

## Notes

`training/stats/stats.rules.ts` still imports `formatDuration` from `@/lib/utils/formatters`, so "src/lib is browser-only" is not strictly true yet; dependency-cruiser does not forbid server-to-lib imports. Moving the formatter to `src/shared` would close it.

[[History Index]]
