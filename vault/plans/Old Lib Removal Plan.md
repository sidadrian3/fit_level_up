# Old Lib Removal Plan

> **For agentic workers:** each task below is one commit. Run `npx eslint <changed files> && npm run typecheck && npm run test:run` before handing a task back; the coordinator reviews and commits. Steps use checkbox (`- [ ]`) syntax for tracking.

**Step:** 5.1 in [[Architecture Overhaul Audit]] (§6, F-18). **Follows:** [[Page Components And WorkoutForm Split Plan]]. **Baseline:** branch `refactor/remove-old-lib` at `3ce0939`; 464 tests in 66 files, all green.

## Thought Process

- **Core challenge:** what is left of the old back end is live code, not dead code. `getUser` serves two routes and two pages, `getAuthUserId` is the seam every route test mocks, and the stamina and active-days rules have callers. Each piece moves to its owner before its folder is deleted. Repointing the route-test auth mocks without breaking `defineRoute`'s auth path is the riskiest step.
- **Edge cases:** a whole-module mock of `@/server/platform/auth` would also stub `auth`, `getAccount` and `getUserTimeZone`, which services call during route tests, so the mocks keep the real exports and replace only `requireSessionUserId`. `getUser` keeps its two reads sequential, because the session it receives may be a transaction. `getActiveDaysThisWeek` uses the same local Monday-to-Sunday week as `weekInstants`, so the activity tracker and "Workouts This Week" can't disagree.
- **Architecture impact:** `src/lib` becomes browser-only. Dependency-cruiser rule G3 loses its strangler exemption, so the server/browser boundary holds everywhere. AGENTS.md and the guides stop describing two systems.

## Problem Statement

The overhaul moved the back end into `src/server`, but five files remain in the old folders: `lib/services/users/get-user.ts`, `lib/domain/stamina-rules.ts`, `lib/domain/user-rules.ts`, `lib/auth/auth-helpers.ts` and the browser-only `lib/auth/client.ts`. Dependency-cruiser G3 still exempts `lib/{services,domain,data,sse,api,auth}` from the "UI reaches the server only for types" rule, so a new file there could quietly import a repository. The dashboard page runs a domain rule (`calcActiveDays`) itself, though pages should call read services only. AGENTS.md still says unit tests live in `src/lib/domain/__tests__/`, that document types sit beside a `-db.ts` file, and that older code has not moved yet. Domain Architecture, the Developer SOP Guide and the Project Briefing repeat those paths.

F-18's other items are already gone: `sse-registry.ts` was deleted with SSE in step 3.8, and the commented-out seeds went with `achievements-db.ts` when definitions became constants in step 3.2.

## Solution

Every piece moves to the module that owns it, and then the old folders are deleted:

| Piece | New home | Why |
|---|---|---|
| `getUser` (account + player state → `User`) | `progression.service.ts`, exported from `@/server/progression` | Most of `User` is player state; progression already reads the account for the time zone |
| `getAuthUserId` | `platform/auth` as `requireSessionUserId` | Pairs with `getSessionUserId` (null when signed out); the name says it throws |
| `calcStaminaCost`, `calcExhaustionDebuff` | `training/stamina.rules.ts` | Only training's workout and run evaluators call them; rules keep importing no module index |
| `calcActiveDays` | `training/stats/stats.rules.ts`, behind a new `getActiveDaysThisWeek` read service | The page stops running a rule; `getWorkoutDatesInRange` leaves training's public API |
| `authClient` | stays in `lib/auth/client.ts` | Browser code; it imports the server only for a type |

Then G3 drops its exemption, AGENTS.md describes only `src/server`, and the handbook sync brings the guides in line.

## Commits

### Task 1: Stamina rules move into training

- [ ] `git mv src/lib/domain/stamina-rules.ts src/server/training/stamina.rules.ts`; move its test to `src/server/training/__tests__/stamina.rules.test.ts` and fix the import.
- [ ] `workout.rules.ts` and `run.rules.ts` import `../stamina.rules`.

Commit: `refactor(training): stamina cost rules move into the training module`.

### Task 2: Active days become a training stats read service

- [ ] Write the failing integration test first, `training/stats/__tests__/get-active-days-this-week.test.ts`: with fake time at `2026-10-22T02:00:00Z` and `America/New_York`, workouts on the local Monday and Tuesday mark indexes 0 and 1, a workout from last Sunday doesn't count, and another user's workout doesn't count.
- [ ] Move `calcActiveDays` (and its private `dayIndexInWeek`) into `stats.rules.ts`; move its unit test into `stats.rules.test.ts`.
- [ ] Add `getActiveDaysThisWeek(userId, { timeZone, now = new Date() }): Promise<boolean[]>` to `stats.service.ts`: `weekInstants` → `findWorkoutDatesInRange` → `calcActiveDays`.
- [ ] Remove `getWorkoutDatesInRange` from `workout.service.ts` and `training/index.ts`; export `getActiveDaysThisWeek`.
- [ ] The dashboard page calls `getActiveDaysThisWeek(userId, { timeZone: user.timeZone, now })` in place of the range read and the rule.
- [ ] Delete `src/lib/domain/` (now empty).

Commit: `refactor(training): dashboard active days come from a stats read service`.

### Task 3: `getUser` moves into progression

- [ ] Move `getUser` into `progression.service.ts` (keep the sequential-read comment); export it from `progression/index.ts`.
- [ ] Point `/api/user`, `/api/stats/dashboard`, and the dashboard and profile pages at `@/server/progression`.
- [ ] Split `lib/services/__tests__/user-time-zone.test.ts`: the signup, `getAccount` and `getUserTimeZone` cases move to `platform/auth/__tests__/account.test.ts`. The `getUser` UTC-default case moves to `progression/__tests__/get-user.test.ts`, with a happy path that merges account and player state and a `NotFoundError` path for an unknown id.
- [ ] Delete `src/lib/services/`.

Commit: `refactor(progression): getUser moves into the progression module`.

### Task 4: `requireSessionUserId` replaces `getAuthUserId`

- [ ] Add `requireSessionUserId` beside `getSessionUserId` in `platform/auth/auth.ts` (throws `UnauthorizedError` on null) and export it from `platform/auth/index.ts`.
- [ ] `runtime.ts` passes it as `requireUserId`; drop the comment about the lib auth seam.
- [ ] The dashboard and profile pages call it.
- [ ] Every route test that mocked `@/lib/auth/auth-helpers` mocks `@/server/platform/auth` with `importOriginal`, replacing only `requireSessionUserId`, and uses `vi.mocked(requireSessionUserId)`.
- [ ] Delete `src/lib/auth/auth-helpers.ts`.

Commit: `refactor(auth): requireSessionUserId in platform/auth replaces the lib auth helper`.

### Task 5: G3 loses its strangler exemption

- [ ] Remove `pathNot` and the "except the old back end" clause from G3 in `.dependency-cruiser.cjs`.
- [ ] `grep -rnE "lib/(services|domain|data|sse|api)|lib/auth/auth-helpers" src tests` prints nothing; `npm run lint` passes.

Commit: `refactor(lint): dependency rule G3 applies to all of src/lib`.

### Task 6: AGENTS.md describes the new architecture

- [ ] **Repo Layout:** the tree shows `src/server/` (`platform/`, `runtime.ts`, the six feature modules), `src/shared/` (contracts, time), `src/lib/` as browser-only (`<domain>/{api,keys,hooks}`, `auth/client.ts`, `env.ts`, `shared/`, `constants/`, `utils/`, `hooks/`), `src/testing/`, and `src/scripts/` (migrate-db and numbered migrations). Drop `src/env.ts` (env lives in `platform/env` and `lib/env.ts`).
- [ ] **File Architecture:** the layers table already names `src/server`; drop the "Older code under `src/lib/services`…" bullet; name the composition root (`runtime.ts`) and the dependency-cruiser rules as the enforcement.
- [ ] **TDD:** unit tests live in the module's `__tests__/` beside the `*.rules.ts` file.
- [ ] **Shared Type Definitions:** document types (`*Doc`) live in `platform/database/schema.ts` (design spec C1).
- [ ] **Testing & Mocks:** "not against mocked repositories" in place of `-db.ts`.
- [ ] Sweep the rest of the file for old paths.

Commit: `docs(agents): AGENTS.md describes the src/server architecture`.

## Decision Document

- `getUser` belongs to progression. It reads the account through `platform/auth` and the player state through progression's own `getPlayerState`, and returns the shared `User` contract unchanged. No new module.
- `requireSessionUserId` is the throwing counterpart of `getSessionUserId`, in `platform/auth`. `defineRoute` keeps receiving it as the injected `requireUserId`, so the HTTP layer still does not import auth.
- Stamina cost and the exhaustion debuff stay pure and belong to training, because they shape an activity's XP before anything is saved. Stamina recovery stays in progression.
- `getActiveDaysThisWeek` is a training read service returning the seven Monday-first booleans the activity tracker already takes. `/api/stats/dashboard` and the `DashboardStats` contract are unchanged.
- `src/lib/auth/client.ts` is browser code and stays.
- Behaviour is preserved: every route, response shape and page renders as before.

## Testing Decisions

- Moved unit tests (stamina, active days) keep their cases unchanged; only their imports change.
- `getActiveDaysThisWeek` and `getUser` get integration tests against the in-memory replica set (happy path plus a boundary or error path), with prior art in `get-dashboard-stats.test.ts` and `get-player-state.test.ts`.
- The route tests are the regression net for Task 4: they still fake the signed-in user, now through `requireSessionUserId`.
- `npm run test:e2e` (the user journey: signup, dashboard, log a workout) confirms the pages still render.

## Out of Scope

- The `@better-fetch/fetch` session round trip in `proxy.ts` (F-18). It changes runtime behaviour, not structure; it is logged in [[Known Issues]].
- Rewriting history notes, old plans and specs that name the old paths. They record what was true at the time.

## Further Notes

The handbook sync (refactor Step 5b) updates Domain Architecture, Data Model And API Reference, Developer Handbook, Developer SOP Guide, Project Briefing and Workout Templates Anatomy, and marks Architecture Review as superseded by [[Architecture Overhaul Design Spec]].

[[Plans Index]]
