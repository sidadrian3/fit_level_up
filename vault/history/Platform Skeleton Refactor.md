# Platform Skeleton Refactor

**Type:** refactor
**Areas:** infra, database, auth, scripts, tooling
**Surfaces:** api-only
**Pipeline outcome:** agentic

## Readiness at start

Preserved behavior covered by tests: yes, the service integration and route tests against the in-memory replica set
Assumptions: previews share the production database; the production custom-exercises collection is `customExercises`; `tsx --conditions=react-server` lets scripts load `server-only`
Riskiest part: validators applied in tests reject a fixture or a current write shape, turning a structural move into a behaviour change

## What was refactored

Audit step 2.1 ([[Platform Skeleton Plan]], issue #22). Infrastructure moved into `src/server/platform/{env,config,domain,database,auth}` and code both sides run into `src/shared/{contracts,time}`. `schema.ts` now holds collection names, document types, indexes and `$jsonSchema` validators for today's collections; numbered migrations run at build in production only; ESLint, dependency-cruiser and `server-only` enforce module boundaries. No route, page or response changed.

## Decisions made

- Previews share the production database ("Production and Preview" in Vercel), so migrations and `applySchema` skip any build where `VERCEL_ENV` is not `production` or unset.
- Validators describe today's writes (`workout_templates.createdAt` and `user_achievements.unlockedDate` stay strings); the step that owns each collection tightens its validator with the code change.
- Env is split by side: server variables in platform, `NEXT_PUBLIC_BETTER_AUTH_URL` in `src/lib/env.ts`, both imported directly by `next.config.ts`.
- "Only repositories get a collection handle" is ESLint rule E3, not a dependency-cruiser rule, because dependency-cruiser cannot see imported names.
- Three pre-existing import cycles in old `src/lib` code are baselined; step 5.1 empties the baseline.
- The pre-commit hook runs dependency-cruiser explicitly, because it lints staged files only.
- Migration numbering was swapped during implementation: `001` renames `customExercises`, `002` dedupes and prepares unique indexes. The dedupe targets `custom_exercises`, which production only has after the rename. A sub-agent flagged this; the plan had it the other way round.
- The live migration run against `.env.local` was skipped, because the database could not be confirmed as non-production.

## Verification

Escalations: Task 6 sub-agent reported a plan-wrong signal (migration order); resolved by renumbering. No other escalations.
UI verified: n/a (no UI change)
Handbook: Data Model And API Reference, Developer SOP Guide, Domain Architecture, Architecture Review, Project Briefing; README env table
Code review: Standards found one hard violation (a hardcoded collection string in `seed-achievements.ts`), a duplicated `collectionExists` and an un-awaited client close, all fixed; Spec found no gaps and no behaviour change.

Boundary proof (temporary edits, reverted, not committed):

- Deep import `@/server/platform/database/schema` in `src/app/api/health/route.ts`: `error  '@/server/platform/database/schema' import is restricted from being used by a pattern. Import a server module through its entry: @/server/<module> or @/server/platform/<area>  no-restricted-imports`
- `import "@/lib/types"` in `src/shared/contracts/run.ts`: `error shared-imports-nothing-app-side: src/shared/contracts/run.ts → src/lib/types.ts`
- `getDb` import in a temporary `src/server/platform/config/tmp.rules.ts`: `error  '@/server/platform/database' import is restricted from being used  no-restricted-imports` (rule E2)

## Notes

- **Unconfirmed before the first production build:** whether Vercel production overrode any `MONGODB_*_COLLECTION` variable other than the custom-exercises one (the others are now ignored), and whether the Atlas tier supports `renameCollection` (shared M0/M2/M5 tiers do not; migration 001 would fail the build loudly if `customExercises` exists).
- Validators go live on the first production build after merge. Writes outside the validator table would fail with a 500; the write paths were audited by hand and by tests, not against production data.
- Fragile boundary: `lib/domain/{user,stamina,workout,run}-rules.ts` import the server-only `platform/config`. No client component imports them today (`calcActiveDays` is used by a server page), but dependency-cruiser's G3 exempts `lib/domain`, so a future client import would fail the Next build rather than lint. Phase 3 moves these rules into modules.
- `runMigrations` is not concurrency-safe: two simultaneous production builds could fail one build on a duplicate-key insert. Migrations are idempotent, so the cost is a failed build.
- `AGENTS.md` still names the old paths (`ensure-indexes.ts`, `validations/schemas.ts`, `game-config.ts`); step 5.1 rewrites it.
- Plan: [[Platform Skeleton Plan]]. Spec: [[Architecture Overhaul Design Spec]].

[[History Index]]
