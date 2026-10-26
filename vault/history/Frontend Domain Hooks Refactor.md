# Frontend Domain Hooks Refactor

**Type:** refactor
**Areas:** workouts, runs, templates, exercises, quests, friends, notifications, stats, achievements, profile, auth, tooling
**Surfaces:** ui
**Pipeline outcome:** agentic

## Readiness at start

Preserved behavior covered by tests: no. Vitest runs in `node` with no DOM, and the only UI test was a Playwright journey that could not pass (it clicked a "Cardio" button and filled an "Exercise name" input that `WorkoutForm` no longer has). Task 1 repaired it and Task 2 added the cross-screen refresh and template tests before any production change.
Assumptions: the React Query cache is not persisted, so renaming keys needs no migration; achievements and dashboard stats stay server-rendered ([[Architecture Overhaul Audit]] §6.5); each PR moves its own domain's response types; `apiFetch` moves first so every new `api.ts` imports its final path once.
Riskiest part: putting workout and run creates onto `useMutation` without breaking `useEntityForm`'s idempotency-key rotation and its "already saved" recovery path.

## What was refactored

Every `useQuery` and `useMutation` moved out of pages and components into `src/lib/<domain>/{keys.ts, api.ts, hooks/}` for progression, quests, friends, notifications, exercises, templates, stats, workouts and runs. Each domain has one query-key table, and each mutation hook owns the invalidation for everything its server change touches. `UserContext` became `useCurrentUser`, response types moved to `src/shared/contracts/`, and `src/lib/types.ts` and `src/lib/data/` were deleted. An ESLint rule now stops `src/app` and `src/components` from importing `@tanstack/react-query`. Shipped as nine stacked PRs, #38 to #46; plan: [[Frontend Domain Hooks Plan]].

## Decisions made

- Domain shape is `keys.ts`, `api.ts`, `hooks/` and `utils/` only where there is content, with no `types/` folder: response types already live in `src/shared/contracts/` (spec C1).
- Keys are plain hierarchical `as const` tables. `queryOptions()` factories were rejected because every query has exactly one hook.
- `invalidateActivityChange(queryClient, activityKey)` in `lib/progression/utils` refreshes an activity's own key plus progression, quests and stats. It started as `invalidateActivityEffects(queryClient)` and took the key parameter in the PR 7 review, when the same two lines appeared in three hooks.
- `useEntityForm` keeps form state, key rotation and error text and takes the domain mutations' `mutateAsync`. The log, update, delete and quest-claim hooks return their invalidation promise, so the form stays busy until the screens are fresh. Rejected: passing it the mutation objects and reading `isPending`.
- `UserContext` became `useCurrentUser()` plus one `<SessionGuard />`, so the sign-out effect runs once instead of once per caller.
- Achievements and dashboard stats got no hooks. They are `force-dynamic` Server Components, so they are fresh on forward navigation; browser Back is recorded in [[Known Issues]] §3 as a stated risk from the Next docs, not reproduced in a browser.
- Create-input types are `z.infer` of the contract schema, so a schema change cannot drift from the type.
- The custom-exercise wrappers moved from raw `fetch()` to `apiFetch`, which changes only the error-text fallback and adds a GET retry.

## Verification

Escalations: none. Two sub-agents handed back an empty report ("pending", "placeholder") instead of their results; I inspected the working tree and ran the checks myself before committing.
UI verified: Playwright on port 3100 against the shared dev database with throwaway accounts: signup and log a workout; log and delete a workout and a run while moving between Quests, Runs, Profile and Workouts by sidebar link, checking sidebar XP, quest progress, run stats and personal records; create a custom exercise and a template and find it in "Start from Template". The friends and notifications screens were not exercised in a browser; they were checked by comparing each diff with the old code.
Handbook: Domain Architecture (new front-end section), Architecture Review, Data Model And API Reference, Developer SOP Guide, Project Briefing, Workout Templates Anatomy, Known Issues

## Notes

- Tests: 464 unit and integration tests before and after; Playwright went from 1 test that could not pass to 3 that do.
- `package.json` pins `@playwright/test` to `^1.61.1` and `playwright` to `^1.64.1`, so `npm run test:e2e` fails on a fresh checkout. I worked around it locally with `npm install --no-save` and left the files alone.
- `playwright-report/` and `test-results/` are tracked in git, so every e2e run dirties them. I restored them each time.
- Left for step 5.1: other stale directory names in the `AGENTS.md` repo tree, the old `src/lib/data` layer rows in Architecture Review and Project Briefing, and the SSE passages in Architecture Review.
- Existing lint warnings (13 unused variables and similar) were left alone.
- PR #33's description still carries a "Generated with Claude Code" footer; it predates the rule about PR descriptions.

[[History Index]]
