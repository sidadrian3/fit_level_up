# Page Components And WorkoutForm Split Refactor

**Type:** refactor
**Areas:** workouts, templates, exercises, runs, quests, friends, profile, notifications, auth, tooling
**Surfaces:** ui
**Pipeline outcome:** agentic

## Readiness at start

Preserved behavior covered by tests: yes, by the Playwright journey that step 4.1 repaired and extended (workout logging, cross-screen refresh, custom exercise in a template). Vitest runs in `node` with no DOM, so there are no component tests.
Assumptions: underscore folders are left out of routing (confirmed in the Next 16 project-structure guide); no component imports `@/server` except for types, so extending G3 to `_components/` passes on day one.
Riskiest part: the WorkoutForm split changing focus-to-muscle behaviour in the Live Pump Tracker, which no test observes.

## What was refactored

Components used by one page moved into `app/(app)/<page>/_components/`; the app shell and cross-page components moved into `components/shared/{auth,layout,notifications,providers,exercises}/`, leaving `components/` with only `ui/` and `shared/`. `useExerciseCatalog` replaced the exercise-catalog code copied between `WorkoutForm` and `CreateTemplateForm`, and `WorkoutForm` split into the form, `WorkoutExerciseRow` and `LivePumpTracker` (468 lines to 286 plus 114 and 40).

## Decisions made

- Subfolders inside `components/shared/`: keeps the shell's relative imports working and the area grouping readable.
- `CreateExerciseModal` is shared, under `shared/exercises/`, because the workout and template pages both render it.
- Form state stays in `WorkoutForm`: it has one caller and is mostly `useEntityForm` configuration.
- `CreateTemplateForm` keeps its own row markup: a shared row would change its UI.
- G3 (UI code reaches `src/server` for types only) now covers `src/app/**/_components/`.
- The Chest-vs-chosen-muscle difference between the two forms was kept through the refactor commits and fixed in a separate `fix(workouts)` commit with an e2e test that failed first.

## Verification

Escalations: none
UI verified: Playwright journey (4 tests) on a throwaway account; `/workouts` and `/templates/new` exercised through it. Pump-tracker highlighting on focus not observed in a browser.
Handbook: AGENTS.md (front-end structure), Architecture Overhaul Audit (F-19, step 4.2 Done), Domain Architecture, Workout Templates Anatomy

## Notes

- `WorkoutForm` ended at 286 lines, above the plan's ~200 estimate; what remains is form shell with one responsibility.
- Left for step 5.1: stale directory names elsewhere in AGENTS.md.
- `playwright-report/` and `test-results/` are tracked in git; I restored them after e2e runs.

[[History Index]]
