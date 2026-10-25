# Server File Layout Refactor

**Type:** refactor
**Areas:** infra, auth, workouts, runs, templates, exercises, stats, quests, achievements, friends, notifications, profile
**Surfaces:** api-only
**Pipeline outcome:** agentic

## Readiness at start

Preserved behavior covered by tests: yes, the integration test per use case against the in-memory replica set, the rules unit tests, the route tests and typecheck for broken imports
Assumptions: a module's `index.ts` is its whole public API, so nothing outside imports its internal files (checked: no deep imports, no `vi.mock` of a moving path)
Riskiest part: the platform folder to file collapse, because `server-only` must stay on each new file and `next.config.ts` loads the env file in plain Node

## What was refactored

Issue #34, [[Server File Layout Plan]]. Every file in a feature module is now `index.ts` or `<noun>.<role>.ts`, and each sub-feature's use cases live in one `<noun>.service.ts`. Event listeners got their own `<noun>.listeners.ts` and count as controllers alongside route handlers. Training's `records/` and `dashboard/` became `stats/`; `getRunStats` moved into the runs service. `config/`, `domain/` and `auth/session.ts` collapsed into single files. Source files under `src/server` went from 102 to 68. `AGENTS.md` and the handbook notes now describe the layout, the controller rule and `defineRoute`. No route, page, export or behaviour changed.

## Decisions made

- Listeners are a role: one answer to "where do listeners live", at the cost of achievements staying at six files.
- Training keeps its sub-folders; flattening would mix five nouns in one folder.
- `social/` files use the noun `friendship`, matching its repository, rules and event names.
- `toPlayerState` stays private in the progression service rather than moving to the rules file, because ESLint forbids rules files from importing database types.
- `platform/env/` stays a folder: `next.config.ts` imports the env definition in plain Node, where the `server-only` guard in the index would throw.
- Controllers may wire modules together (the dashboard route passes `countUnlockedAchievements` into training). A strict one-call-per-action rule needs a `stats` read module, filed as #35.
- `formatExerciseName` left the training entry because nothing imported it.

## Verification

Escalations: none. A merge script's first auth merge failed on a BSD `sed` call; the files were untouched and the merge was redone in Python. One commit blocked by the pre-commit hook because a test still imported a deleted file; fixed and committed.
UI verified: n/a
Handbook: Domain Architecture, Data Model And API Reference, Project Briefing, Known Issues
Review: mechanical rather than sub-agent. Every module's `index.ts` exports the same names (only `formatExerciseName` left training's), every non-import line of the 102 base files is present at HEAD with only `export` keywords and imports changed, `server-only` and the event-augmentation imports are intact.

## Notes

The plan estimated about 55 files; the actual count is 68 because the estimate was made before PR #33 and without counting every file. Further merges would need #35 first. Option left: fold each `<noun>.events.ts` into its service, which would remove six more files but mix the event contract into use-case code.
