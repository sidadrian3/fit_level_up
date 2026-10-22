# Platform Skeleton Plan

**Status:** Draft, 2026-10-22. Issue [#22](https://github.com/sidadrian3/fit_level_up/issues/22). Step 2.1 in [[Architecture Overhaul Audit]] §8, implementing [[Architecture Overhaul Design Spec]] D3, D5, D8, C1 and C8. Refactor: no route, page, status code or response changes.

## Problem Statement

The infrastructure every feature depends on is scattered through `src/lib/`. The Mongo client, environment variables, game tuning, the better-auth config, collection names (in two places that disagree) and indexes are mixed in with browser code, services and helpers. The data model is spread across ten `-db.ts` files and `ensure-indexes.ts`, and MongoDB enforces none of it. Module boundaries hold only by convention, which the audit showed already slips. Steps 2.2–2.5 and every Phase 3 module move need one place for this infrastructure, one readable data model, and tooling that fails when a boundary is crossed.

## Solution

- **Infrastructure** moves into `src/server/platform/{env,config,domain,database,auth}`.
- **Code both sides run** (Zod input schemas, `TargetMuscle`/`Exercise`, calendar helpers) moves into `src/shared/{contracts,time}`.
- **`schema.ts`** becomes the single description of today's collections: names, document types, indexes, and validators that match what today's code writes.
- **Database changes** become numbered migrations, recorded in `schema_migrations`, run at build for production only.
- **Boundaries** are enforced by ESLint (file rules), dependency-cruiser (graph rules) and `server-only` (build).

## Readiness

```
Preserved behavior covered by tests:  yes — service integration tests (log-workout, friends, quests, achievements, exercises, templates, time zone, dashboard), route tests (workouts, runs, exercises, templates, quest claim, cron), prepare-unique-indexes test
Open questions:   none
Assumptions:      - MONGODB_CUSTOM_EXERCISES_COLLECTION may or may not be set in Vercel; migration 002 handles both, and fails loudly if both collections hold data
                  - Vercel previews share the production MONGODB_DB ("Production and Preview"); migrations and applySchema run only when VERCEL_ENV is production or unset
                  - Preview builds run against the unmigrated database until merge (e.g. custom exercises look empty on a 2.1 preview)
                  - tsx passes --conditions=react-server through to Node (verified in Task 1)
Riskiest part:    validators applied in tests reject a fixture or a current write shape, turning a structural move into a behaviour change
```

## Decisions (from the brainstorm and grill, 2026-10-22)

1. **Env split by side.**
   - `src/server/platform/env/env.ts` holds the server variables.
   - `src/lib/env.ts` holds the one client variable (`NEXT_PUBLIC_BETTER_AUTH_URL`), which the browser auth client reads.
   - `next.config.ts` imports both files directly (never an `index.ts`), so the build still validates every variable.
2. **Validators describe today's writes**, not the ideal shape. `workout_templates.createdAt` and `user_achievements.unlockedDate` stay strings, and `user_quests.periodStart` accepts `"all-time"`. Each is tightened in the step that owns its data (3.3, 3.4, 3.6), together with the code change.
3. **`schema.ts` covers today's collections only.** `player_profiles`, `xp_ledger`, `outbox` and `notifications` are added by the steps that create them. `quest_templates` and `achievements` get names and indexes but no validator, and their doc types stay in their `-db.ts` files: both retire in 3.2, and `AchievementDefinitionDoc` depends on a domain type.
4. **Collection keys are renamed at every call site** (`"workoutsCollection"` → `"workouts"`), with no compatibility map.
5. **`server-only` goes in every `index.ts` under `src/server`.**
   - Vitest aliases it to an empty module.
   - Scripts run with `tsx --conditions=react-server`.
   - Files outside Next's server layer (`next.config.ts`) import the file behind the index, never the index.
6. **Migrations run only in production.** Previews share the production database, so `migrate-db.ts` runs migrations and `applySchema` only when `VERCEL_ENV` is `production` or unset (local builds), and logs a skip otherwise.
7. **Migration 002 is safe in every state.**

   | State | Action |
   |---|---|
   | Only `customExercises` exists | Rename it to `custom_exercises` |
   | Both exist, `customExercises` empty | Drop `customExercises` |
   | Both exist, `customExercises` holds documents | Fail the build with a clear message |
   | Otherwise | No-op |

8. **`getCollection` restriction (spec G7) becomes an ESLint rule (E3), not dependency-cruiser.** dependency-cruiser sees imports of `@/server/platform/database`, not which names are imported, so only ESLint's `importNames` can say "only `*.repository.ts` may import `getCollection`".
9. **The pre-commit hook runs dependency-cruiser** after its ESLint step. The hook lints staged files only, so it would otherwise never run graph rules.
10. **Pre-existing violations go in a baseline.** If dependency-cruiser finds violations in today's `src/lib` code (most likely cycles through `lib/types.ts` ↔ `lib/utils`), they are recorded in `.dependency-cruiser-known-violations.json` and `npm run lint` passes `--ignore-known`. Step 5.1 empties the baseline. This replaces the spec's path-based G3 exemption for cycles; the G3 path exemption stays for the `lib → server` direction.
11. **ESLint ignores `.agents/**` and `.claude/**`.** They are gitignored, so CI never sees them, but they hold 21 local lint errors that make local `npm run lint` fail, so "lint fails on a deep import" proves nothing until they're ignored.

## Collection Key Map (Task 4)

| Old key (`getDbConfig`) | New key (`COLLECTIONS`) | Name |
|---|---|---|
| `usersCollection` | `user` | `user` |
| `workoutsCollection` | `workouts` | `workouts` |
| `runsCollection` | `runs` | `runs` |
| `questTemplatesCollection` | `questTemplates` | `quest_templates` |
| `userQuestsCollection` | `userQuests` | `user_quests` |
| `achievementsCollection` | `achievements` | `achievements` |
| `userAchievementsCollection` | `userAchievements` | `user_achievements` |
| `customExercisesCollection` | `customExercises` | `custom_exercises` |
| `friendshipsCollection` | `friendships` | `friendships` |
| `workoutTemplatesCollection` | `workoutTemplates` | `workout_templates` |
| — | `session`, `account`, `verification` | better-auth, named only |
| — | `schemaMigrations` | `schema_migrations` (Task 6) |

## File Structure (end state)

```
src/
  shared/
    contracts/exercise.ts     TargetMuscle, Exercise, ExerciseSchema, CreateCustomExerciseSchema
    contracts/workout.ts      CreateWorkoutSchema
    contracts/run.ts          CreateRunSchema
    contracts/template.ts     WorkoutTemplateSchema
    contracts/friendship.ts   SendFriendRequestSchema
    contracts/user.ts         timeZoneSchema
    time/calendar.ts          (was lib/utils/dates.ts) + __tests__/calendar.test.ts
  server/platform/
    env/{env.ts,index.ts}
    config/{game-config.ts,index.ts}
    domain/{domain-error.ts,index.ts}
    database/{client.ts,schema.ts,get-collection.ts,apply-schema.ts,index.ts}
    auth/{auth.ts,index.ts}
  lib/env.ts                  client env
  scripts/migrate-db.ts       guard → runMigrations → applySchema
  scripts/migrations/{index.ts,run-migrations.ts,001-prepare-unique-indexes.ts,002-rename-custom-exercises.ts,__tests__/}
tests/stubs/server-only.ts    empty module for the Vitest alias
.dependency-cruiser.cjs
```

**Deleted:**
- `src/env.ts`
- `src/lib/mongodb.ts`
- `src/lib/data/{get-collection,db-config,ensure-indexes}.ts`
- `src/lib/config/game-config.ts`
- `src/lib/domain/domain-error.ts`
- `src/lib/auth/server.ts`
- `src/lib/validations/schemas.ts`
- `src/lib/utils/dates.ts` (and its test)
- `src/scripts/prepare-unique-indexes.ts` (and its test)

---

## Tasks

Every task leaves `npx eslint <changed files> && npm run typecheck && npm run test:run` green, and ends with its own commit. The tasks form a chain; there are no parallel groups, because each one re-points importers the next one also touches.

### Task 1: Tooling prerequisites

**Files:** `eslint.config.mjs`, `package.json`, `package-lock.json`, `vitest.config.ts`, `tests/stubs/server-only.ts`
**Interfaces:** Consumes nothing. Produces the `server-only` alias for tests, the `react-server` condition for scripts, and a clean local `npm run lint`.

1. Add `.agents/**` and `.claude/**` to `globalIgnores` in `eslint.config.mjs`. Run `npm run lint` and confirm 0 errors (warnings may remain).
2. `npm install server-only` (a runtime dependency) and `npm install -D dependency-cruiser`.
3. Create `tests/stubs/server-only.ts` (`export {};`) and add `"server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts")` to `test.alias` in `vitest.config.ts`.
4. Change the `build` and `seed` scripts to run `tsx --conditions=react-server …` (keep the existing `--env-file…` flags).
5. Verify in a throwaway file outside the repo (scratchpad) that `npx tsx --conditions=react-server -e "import('server-only').then(() => console.log('ok'))"` prints `ok`, and that without the flag it throws. If the flag isn't passed through, stop: this is a plan-wrong signal.
6. Commit `refactor(tooling): ignore local agent folders and add server-only and dependency-cruiser`.

### Task 2: `src/shared` — contracts and calendar

**Files:**
- New: `src/shared/contracts/{exercise,workout,run,template,friendship,user}.ts`, `src/shared/time/calendar.ts`, `src/shared/time/__tests__/calendar.test.ts`
- Modified: `src/lib/types.ts`, every importer of `@/lib/validations/schemas` and `@/lib/utils/dates` (see Consumes)
- Deleted: `src/lib/validations/schemas.ts`, `src/lib/utils/dates.ts`, `src/lib/utils/__tests__/dates.test.ts`

**Interfaces:**
- **Consumes.** Importers to re-point:
  - schemas: `api/workouts/route.ts`, `api/workouts/[id]/route.ts`, `api/exercises/route.ts`, `api/friends/request/route.ts`, `api/runs/route.ts`, `api/runs/[id]/route.ts`, `api/workout-templates/route.ts`, `components/workouts/WorkoutForm.tsx`, `components/runs/RunForm.tsx`, `lib/auth/server.ts`, `lib/services/workout-templates/create-workout-template.ts`;
  - dates: `app/(app)/dashboard/page.tsx`, `lib/utils/browser-time-zone.ts`, `lib/domain/quest-rules.ts`, `lib/domain/user-rules.ts`, `lib/services/quests/update-quest-progress.ts`, `lib/services/quests/get-user-quests.ts`, `lib/services/users/user-state.service.ts`, `lib/services/users/get-dashboard-stats.ts`.
- **Produces.** `@/shared/contracts/<domain>` and `@/shared/time/calendar`. `src/lib/types.ts` re-exports `TargetMuscle` and `Exercise` from `@/shared/contracts/exercise`, so its 26 component and page importers don't change.

1. Move `TargetMuscle` (the runtime enum) and the `Exercise` interface from `lib/types.ts` to `shared/contracts/exercise.ts`. `lib/types.ts` re-exports both with `export { TargetMuscle } from …` and `export type { Exercise } from …`.
2. Split `lib/validations/schemas.ts` into the six contract files, one per domain (see File Structure), with each schema's text unchanged. `user.ts` imports `isValidTimeZone` from `@/shared/time/calendar`.
3. `git mv` `lib/utils/dates.ts` → `shared/time/calendar.ts` and its test → `shared/time/__tests__/calendar.test.ts`. The test's import of `timeZoneSchema` points at `@/shared/contracts/user`.
4. Re-point every importer listed under Consumes. `src/shared/**` may import only `zod` and other `src/shared` files.
5. Run the checks and commit `refactor(shared): move input schemas, exercise types and calendar helpers into src/shared`.

### Task 3: `platform/env`, `platform/config`, `platform/domain`

**Files:**
- New: `src/server/platform/env/{env.ts,index.ts}`, `src/server/platform/config/{game-config.ts,index.ts}`, `src/server/platform/domain/{domain-error.ts,index.ts}`, `src/lib/env.ts`
- Modified: `next.config.ts`, the importers listed under Consumes
- Deleted: `src/env.ts`, `src/lib/config/game-config.ts`, `src/lib/domain/domain-error.ts`

**Interfaces:**
- **Consumes.** Importers to re-point:
  - env: `lib/mongodb.ts`, `lib/data/db-config.ts`, `lib/auth/server.ts`, `lib/auth/client.ts`, `api/cron/achievements-sweep/route.ts`, `scripts/seed-quests.ts`, `scripts/seed-achievements.ts`;
  - game-config: `lib/domain/{stamina,workout,user,run}-rules.ts`;
  - domain-error: `lib/domain/{quest,friend,workout,run}-rules.ts`, `lib/api/handle-api-error.ts`, `lib/api/__tests__/handle-api-error.test.ts`, `lib/services/__tests__/friends.test.ts`.
- **Produces.** `@/server/platform/env` (`env`), `@/server/platform/config` (`GAME_CONFIG`), `@/server/platform/domain` (`DomainError`, `DomainErrorKind`), `@/lib/env` (`clientEnv`).

1. Create `platform/env/env.ts` with `createEnv` holding every **server** variable from `src/env.ts`, unchanged; the collection-name variables go in Task 4. Create `src/lib/env.ts` with `createEnv` holding only the `client` block and its `experimental__runtimeEnv`. Delete `src/env.ts`.
2. Each `index.ts` starts with `import "server-only";` and re-exports its area's public names.
3. `next.config.ts` imports `"./src/server/platform/env/env"` and `"./src/lib/env"`, both directly.
4. `lib/auth/client.ts` reads `NEXT_PUBLIC_BETTER_AUTH_URL` from `@/lib/env`.
5. `git mv` `game-config.ts` and `domain-error.ts` into their areas. Re-point every importer through the area's `index.ts`.
6. The seed scripts import `@/server/platform/env` (the `react-server` condition from Task 1 makes that load).
7. Run the checks, plus `npx next build` once to prove `next.config.ts` still validates env. Use `next build`, not `npm run build`, which would also run migrations against the `.env.local` database. Commit `refactor(platform): add env, config and domain areas; split client env`.

### Task 4: `platform/database` — client, `schema.ts`, `getCollection`, `applySchema`

**Files:**
- New: `src/server/platform/database/{client.ts,schema.ts,get-collection.ts,apply-schema.ts,index.ts}`
- Modified: every `src/lib/data/*-db.ts`; `lib/services/{quests/claim-quest-reward,workouts/log-workout,runs/log-run}.ts`; `lib/auth/server.ts`; `scripts/migrate-db.ts`; `scripts/prepare-unique-indexes.ts` and its test; `vitest.global-setup.ts`; `platform/env/env.ts`; every test that calls `getCollection` or `ensureIndexes` (22 files, listed by `grep -rl "getCollection\|ensureIndexes" src --include=*.test.ts`)
- Deleted: `src/lib/mongodb.ts`, `src/lib/data/{get-collection,db-config,ensure-indexes}.ts`

**Interfaces:**
- **Consumes:** `env` from `@/server/platform/env`, and `TargetMuscle`/`Exercise` from `@/shared/contracts/exercise`.
- **Produces:** `@/server/platform/database` exporting:
  - `client`, `clientPromise`;
  - `COLLECTIONS`, `CollectionKey`;
  - `getCollection<T>(key: CollectionKey)` and `getDb()`;
  - `applySchema(db)`;
  - the document types `WorkoutDoc`, `RunDoc`, `CustomExerciseDoc`, `WorkoutTemplateDoc`, `UserQuestDoc`, `UserAchievementDoc`, `FriendshipDoc`, `UserDoc`.

1. `git mv src/lib/mongodb.ts src/server/platform/database/client.ts`. Keep its dev-mode global caching unchanged.
2. Write `schema.ts`, top to bottom (spec C8):
   1. `COLLECTIONS` as in the Collection Key Map (without `schemaMigrations`, added in Task 6).
   2. The document types, moved verbatim from the `-db.ts` files and renamed. Rename `*MongoDoc` to `*Doc`. `WorkoutDoc` and `RunDoc` become exported. `QuestTemplateMongoDoc` and `AchievementDefinitionDoc` stay in their `-db.ts` files (Decision 3).
   3. `SCHEMA: Record<SchemaCollection, { indexes: (IndexDescription & { name: string })[] }>`, holding exactly the indexes `ensure-indexes.ts` creates today, with the same keys, names and options, grouped by collection.
   4. `RETIRED_INDEXES` (empty for now).
3. `get-collection.ts`: `getCollection<T extends Document>(key: CollectionKey): Promise<Collection<T>>` resolves `COLLECTIONS[key]` in `env.MONGODB_DB`. `getDb()` returns the `Db`.
4. `apply-schema.ts`: `applySchema(db: Db)`. For each `SCHEMA` entry it creates the collection if missing, then runs `createIndexes`. Then it drops each `RETIRED_INDEXES` entry that exists. It must be idempotent.
5. Drop the ten `MONGODB_*_COLLECTION` variables from `platform/env/env.ts` and from `vitest.global-setup.ts`.
6. Re-point every importer:
   - collection keys per the Key Map;
   - `clientPromise`/`client` from `@/server/platform/database`;
   - doc types from `@/server/platform/database`.
   - The `-db.ts` mapping functions (`toWorkout`, …) stay where they are.
7. `vitest.global-setup.ts`: after setting `process.env`, `const { applySchema, getDb } = await import("@/server/platform/database")`, `await applySchema(await getDb())`, then close the client. Remove every `ensureIndexes()` call from the tests (global setup now covers it). If the global setup cannot resolve the `@/` alias or `server-only`, stop with a plan-wrong signal; don't improvise a per-file hook.
8. `migrate-db.ts` calls `prepareUniqueIndexes()` then `applySchema(db)`. That is the same order as today; Task 6 replaces it.
9. Run the checks. The custom-exercises tests now use `custom_exercises`, as production will after migration 002. Commit `refactor(database): move the Mongo client into platform and make schema.ts the source of names, doc types and indexes`.

### Task 5: `platform/auth`

**Files:**
- New: `src/server/platform/auth/{auth.ts,index.ts}`
- Modified: `src/lib/auth/client.ts`, `src/lib/auth/auth-helpers.ts`, `src/app/api/auth/[...all]/route.ts`, `src/lib/services/__tests__/user-time-zone.test.ts`
- Deleted: `src/lib/auth/server.ts`

**Interfaces:**
- **Consumes:** `client` and `env` from platform, and `timeZoneSchema` from `@/shared/contracts/user`.
- **Produces:** `@/server/platform/auth` exporting `auth`.

1. `git mv src/lib/auth/server.ts src/server/platform/auth/auth.ts`. Keep the config unchanged: email and password, `additionalFields.timeZone` validated by `timeZoneSchema`.
2. `index.ts`: `import "server-only"; export { auth } from "./auth";`
3. `lib/auth/client.ts` becomes `import type { auth } from "@/server/platform/auth";`. It's a type-only import, erased at build, so `server-only` never reaches the browser.
4. Re-point `auth-helpers.ts`, the better-auth route and the time-zone test.
5. Run the checks plus `npx next build` (this proves the client bundle still builds with the type-only import). Commit `refactor(auth): move the better-auth config into platform/auth`.

### Task 6: Migration runner, migrations 001–002, preview guard

**Files:**
- New: `src/scripts/migrations/{index.ts,run-migrations.ts,001-prepare-unique-indexes.ts,002-rename-custom-exercises.ts}`, `src/scripts/migrations/__tests__/{run-migrations,001-prepare-unique-indexes,002-rename-custom-exercises}.test.ts`
- Modified: `src/scripts/migrate-db.ts`, `src/server/platform/database/schema.ts` (`schemaMigrations`)
- Deleted: `src/scripts/prepare-unique-indexes.ts`, `src/scripts/__tests__/prepare-unique-indexes.test.ts`

**Interfaces:**
- **Consumes:** `getDb`, `COLLECTIONS`, `applySchema`.
- **Produces:**
  - `Migration { name: string; up(db: Db): Promise<void> }`;
  - `MIGRATIONS: Migration[]` (ordered);
  - `runMigrations(db, migrations): Promise<string[]>`, returning the names applied this run;
  - `shouldRunMigrations(vercelEnv: string | undefined): boolean`.

1. **Test first** (`run-migrations.test.ts`):
   - two fake migrations run in order and are recorded in `schema_migrations` as `{ _id: name, appliedAt: Date }`;
   - a second `runMigrations` call runs nothing;
   - a migration that throws is not recorded, and stops the run;
   - `shouldRunMigrations` is true for `undefined` and `"production"`, false for `"preview"` and `"development"`.
2. Implement `run-migrations.ts`, and add `schemaMigrations: "schema_migrations"` to `COLLECTIONS`. It gets no `SCHEMA` entry: no validator, and `_id` is the only key.
3. `001-prepare-unique-indexes.ts`: the body of `prepareUniqueIndexes`, rewritten as `up(db)` using `db.collection(COLLECTIONS.x)`, logic unchanged. Move its test with it; the assertions stay the same.
4. **Test first** (`002-rename-custom-exercises.test.ts`), covering the four states of Decision 7:
   - only the old collection exists → it is renamed and keeps its documents;
   - both exist, old empty → the old one is dropped;
   - both exist, old non-empty → it throws, naming both collections;
   - neither exists, or only the new one → no-op.
   Each test drops `customExercises` and `custom_exercises` in its own cleanup, then calls `applySchema` to restore the new collection's indexes. Implement the migration.
5. `MIGRATIONS = [m001, m002]`.
6. Rewrite `migrate-db.ts`:
   1. If `!shouldRunMigrations(process.env.VERCEL_ENV)`, log `Skipping migrations: VERCEL_ENV=<value> shares the production database` and exit 0.
   2. Otherwise: `runMigrations(db, MIGRATIONS)` → `applySchema(db)` → log the applied names → exit 0. Any error → exit 1.
7. Run the checks, plus `npx tsx --conditions=react-server --env-file-if-exists=.env.local src/scripts/migrate-db.ts` once against the `.env.local` database (the Atlas dev database, per [[Per-User Time Zone]]), and confirm it records 001 and 002. Commit `refactor(migrations): numbered migration runner with schema_migrations and a production-only guard`.

### Task 7: Validators

**Files:** `src/server/platform/database/{schema.ts,apply-schema.ts}`, and test files whose fixtures the validators reject (expected: `get-dashboard-stats.test.ts`, `migrations/__tests__/001-prepare-unique-indexes.test.ts`, possibly `friends.test.ts`, `claim.test.ts`, `update-quest-progress.test.ts`)
**Interfaces:** Consumes `SCHEMA`. Produces `SCHEMA[c].validator` for app-owned collections. `applySchema` applies them with `validationLevel: "moderate"` and `validationAction: "error"`.

1. Extend the `SCHEMA` entry type with `validator?: { $jsonSchema: Document }`. In `applySchema`, pass the validator to `createCollection` when creating, or to `collMod` when the collection exists.
2. Write validators that match **today's writes** (Decision 2). Every validator uses `bsonType: "object"`, lists `required`, and types each listed field. Number fields use `bsonType: "number"`; `_id` is left untyped.

   | Collection | Required (type) | Optional (type) |
   |---|---|---|
   | `workouts` | `userId` (string), `title` (string), `exercises` (array), `duration` (number), `xpEarned` (number), `date` (date) | `idempotencyKey` (string) |
   | `runs` | `userId` (string), `distance`, `duration`, `pace`, `xpEarned` (number), `difficulty` (enum `easy`/`moderate`/`hard`/`intense`), `date` (date) | `idempotencyKey` (string) |
   | `custom_exercises` | `userId`, `name` (string), `targetMuscle` (enum of `TargetMuscle` values) | — |
   | `workout_templates` | `userId`, `name`, `idempotencyKey`, `createdAt` (**string**), `exercises` (array) | — |
   | `user_quests` | `userId`, `questTemplateId`, `periodStart`, `periodEnd` (string), `progress`, `target` (number), `completed`, `claimed` (bool) | — |
   | `user_achievements` | `userId`, `achievementId`, `unlockedDate` (**string**) | — |
   | `friendships` | `requesterId`, `receiverId`, `pairKey` (string), `status` (enum `pending`/`accepted`/`declined`), `createdAt`, `updatedAt` (date) | — |

   `user`, `session`, `account`, `verification`, `quest_templates` and `achievements` get no validator.
3. **Test first:** `src/server/platform/database/__tests__/apply-schema.test.ts`:
   - inserting a workout with `date` as a string is rejected (code 121);
   - inserting a complete workout succeeds;
   - running `applySchema` twice is idempotent.
4. Run `npm run test:run`. For each rejected fixture:
   - **a partial fixture** (e.g. dashboard workouts with no exercises) → complete it with the fields today's code writes;
   - **a deliberate legacy shape** (migration 001's friendships without `pairKey`, unlock duplicates) → insert with `{ bypassDocumentValidation: true }` and a one-line comment saying it simulates pre-validator data.
   - **Never loosen a validator to pass a test.** If production code itself writes a shape the table rejects, stop: that's a plan-wrong signal, and the table is wrong.
5. Run the checks and commit `refactor(database): $jsonSchema validators matching today's write shapes`.

### Task 8: Retire redundant indexes

**Files:** `src/server/platform/database/schema.ts`, `src/lib/services/friends/send-friend-request.ts`, `src/lib/services/__tests__/friends.test.ts`, `src/server/platform/database/__tests__/apply-schema.test.ts`
**Interfaces:** Consumes `RETIRED_INDEXES` and `applySchema`. Produces nothing new.

1. Remove these indexes from `SCHEMA` and add them to `RETIRED_INDEXES`, each with the comment `// retired in 2.1: prefix of a unique index` or `// retired in 2.1: superseded by pairKey`:
   - `friendships.idx_friendships_requester_receiver`;
   - `user_achievements.idx_userAchievements_userId`;
   - `custom_exercises.idx_customExercises_userId`.
2. **Test first:** `applySchema` drops an index listed in `RETIRED_INDEXES` when it exists, and tolerates its absence. Confirm `friends.test.ts` already asserts that a same-direction repeat request → `ConflictError` ("already sent"); add that assertion if missing.
3. In `send-friend-request.ts`, remove `|| isDuplicateKeyError(error, "requesterId")` and its comment. Only the `pairKey` index fires now.
4. Run the checks and commit `refactor(database): retire indexes made redundant by Phase 0 unique keys`.

### Task 9: Boundary rules, lint wiring and the proof

**Files:** `eslint.config.mjs`, `.dependency-cruiser.cjs`, `.dependency-cruiser-known-violations.json` (only if needed), `package.json`, `.husky/pre-commit`
**Interfaces:** Consumes the folder layout from Tasks 2–5. Produces `npm run lint` = ESLint + dependency-cruiser.

1. **ESLint** (`no-restricted-imports`):

   | # | Files | Rule |
   |---|---|---|
   | E1 | `src/**/*.{ts,tsx}` | Patterns `["@/server/*/*", "!@/server/platform/*"]` and `["@/server/platform/*/*"]`, with the message `"Import a server module through its entry: @/server/<module> or @/server/platform/<area>."` |
   | E2 | `src/server/**/*.rules.ts` | Block `mongodb`, `next`, `next/*`, `@/server/platform/database`, `@/server/platform/http`, `@/server/platform/events`, `@/server/platform/auth`, `@/server/platform/env`, and `**/*.repository` |
   | E3 | `src/server/**` except `src/server/platform/**`, `**/*.repository.ts` and `**/__tests__/**` | Block `importNames: ["getCollection", "getDb"]` from `@/server/platform/database` |

2. **`.dependency-cruiser.cjs`.** Set `tsConfig` to `tsconfig.json`, `tsPreCompilationDeps: true`, and `doNotFollow: node_modules`. Rules:

   | # | Rule |
   |---|---|
   | G1 | `no-circular` |
   | G2 | `src/shared` → not `src/(server|lib|components|app)` |
   | G3 | `src/(lib|components)` → not `src/server`, except paths matching `^src/lib/(services|domain|data|sse|api|auth)/` (the strangler exemption) and except `dependencyTypes` `type-only` |
   | G4 | `src/server/platform` → not `src/server/(?!platform)` |
   | G5 | `src/server/(?!notification)` and `src/server/(?!achievements)` → not `src/server/notification`, `src/server/achievements`, except from `src/server/runtime.ts` |
   | G6 | Only `src/app` may import `src/server/runtime.ts` |

   G5 and G6 match nothing yet; they are in place for 2.2 and Phase 3.
3. Run `npx depcruise src --config .dependency-cruiser.cjs`.
   - Violations in **new** code → fix them.
   - Violations in **old** `src/lib` code → record them with `--output-type baseline > .dependency-cruiser-known-violations.json`, and use `--ignore-known` in the lint script.
4. `package.json`: `"lint": "eslint && depcruise src --config .dependency-cruiser.cjs"`, adding `--ignore-known` only if the baseline exists. `.husky/pre-commit`: after the ESLint step, run the same `depcruise` command, with `|| { echo "pre-commit: dependency rules failed"; exit 1; }`.
5. **The proof (not committed):**
   - Add `import { SCHEMA } from "@/server/platform/database/schema";` to `src/app/api/health/route.ts`. Confirm `npm run lint` fails with the E1 message and VS Code shows the underline. Revert.
   - Add a temporary import from `src/shared/contracts/run.ts` to `@/lib/types`. Confirm depcruise fails G2. Revert.
   - Record both outputs in the history log.
6. Run `npm run lint && npm run typecheck && npm run test:run`, then commit `refactor(tooling): enforce module boundaries with ESLint and dependency-cruiser`.

---

## Done When

- `npm run lint`, `npm run typecheck`, `npm run test:run` and `npx next build` pass.
- No file imports the deleted paths.
- The deliberate deep import fails lint (Task 9 proof).
- Every route and page behaves as before: the existing route tests pass unchanged, apart from fixture completions in Task 7.

## Spec Amendments (applied with this plan)

[[Architecture Overhaul Design Spec]] is amended in the same commit:
- C1: the env split (`src/lib/env.ts` for the client variable).
- C8: `schema.ts` grows with each step (today's collections in 2.1), and validators match today's write shapes until the owning step tightens them.
- D3: G7 becomes ESLint rule E3; the pre-commit hook runs dependency-cruiser explicitly; a known-violations baseline covers old code.

[[Plans Index]]
