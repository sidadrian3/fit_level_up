# Server File Layout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every file under `src/server` says its role in its name, and there are fewer of them. A feature module holds `index.ts` plus `<noun>.<role>.ts` files; each sub-feature's use cases live in one `<noun>.service.ts`. About 87 source files become about 55.

**Architecture:** Pure file moves and merges. Code moves verbatim; no logic, signature or behaviour changes. Every module's `index.ts` keeps exporting the same names, so `src/app`, `src/server/runtime.ts` and other modules do not change. Dependencies between modules do not change.

**Tech Stack:** TypeScript, Vitest against the in-memory replica set, ESLint boundary rules in `eslint.config.mjs`.

**Issue:** #34. Follow-up: #35, a `stats` read module so every controller makes one service call.

## Naming rule

- **Feature module** (`achievements`, `notification`, `progression`, `quests`, `social`, `training`): every file is `index.ts` or `<noun>.<role>.ts`.
- **Roles:**
  - `service`: the sub-feature's use cases, exported through `index.ts`. Private steps shared by those use cases are non-exported functions in the same file.
  - `repository`: one collection's data access.
  - `rules`: pure domain rules.
  - `definitions`: typed constant tables.
  - `events`: the `declare module "@/server/platform/events"` contract.
  - `listeners`: event controllers.
  - `adapters`: callbacks one module hands another.
- **Noun:** what the file works on. `achievement`, `notification`, `progression` (repositories keep their collection nouns `profile`, `xp-ledger`), `quest`, `friendship` (folder stays `social/`), `training` (top level), and in training's sub-folders `workout`, `run`, `template`, `exercise` (repository keeps `custom-exercise`), `stats`.
- **Controllers:** `route.ts` handlers and `<noun>.listeners.ts`. A controller may call services from several modules and pass one module's function into another. It never holds business rules, never touches a repository, and never runs its own `try/catch`, auth or parsing (`defineRoute` does that). Pages call read services only; every write goes through an API route.
- **Platform:** one file per infrastructure concern, or a folder when the concern has several distinct parts.

## Global Constraints

- Read `AGENTS.md` before touching code. No `any`.
- **Move, don't rewrite.** Function bodies, signatures, comments and export names stay byte-identical. The only edits allowed are import lines, the order of functions inside a merged file, and dropping `export` from a helper that no longer has a caller outside its file.
- Use `git mv` on the largest source file into its new name, then append the others and `git rm` them, so `git log --follow` keeps the largest share of history.
- Inside a merged file: imports at the top (merged, deduplicated), then module-level constants and types, then each exported use case in the order `index.ts` lists it, with its private helpers immediately above its first caller.
- Side-effect imports `import "./events"` follow the rename to `import "./<noun>.events"`.
- Tests stay one file per use case. They keep their names, move with the code they test, and only their imports change.
- Each task ends with `npx eslint <changed files> && npm run typecheck && npm run test:run` green, and is one commit `refactor(<scope>): …`. A `Cannot find module` error from `.next/types` is a stale cache: `rm -rf .next` and rerun.
- Never `--no-verify`.

## Review Focus

1. **Public surface unchanged:** for each module, the set of names exported from `index.ts` before and after is identical (diff `git show <base>:<path>/index.ts` against the new one's resolved exports).
2. **Verbatim moves:** `git diff -M --stat <base>` and a word diff of each merged file show only import and `export`-keyword changes.
3. **`server-only` kept:** `platform/config.ts`, `platform/domain.ts` and `platform/auth/auth.ts` each import `"server-only"` first; `platform/env/env.ts` still does not (it is loaded by `next.config.ts` in plain Node).
4. **Event augmentation kept:** every `declare module "@/server/platform/events"` block still exists, and each former `import "./events"` points at the renamed file.

## Decisions

- **Listeners are a role.** `achievementListeners` leave the achievements service for `achievement.listeners.ts`; notification's `listeners.ts` becomes `notification.listeners.ts`. Achievements stays at 6 files in exchange for one answer to "where do listeners live".
- **Training keeps its sub-folders.** Each folder is one sub-feature sharing one noun; flattening would mix five nouns in one 16-file folder.
- **`records/` and `dashboard/` become `stats/`.** `getPersonalRecords` and `getDashboardStats` are read-only summaries across workouts and runs. `getRunStats` reads only runs, so it moves to `runs/run.service.ts`. `records.rules.ts` is renamed `stats.rules.ts` so the folder uses one noun.
- **`toPlayerState` stays private in `progression.service.ts`**, not moved to `progression.rules.ts` as first discussed. ESLint forbids `*.rules.ts` importing `@/server/platform/database`, which `toPlayerState`'s `PlayerProfileDoc` input needs. After the merge every caller is in the service file, so the reason to move it (a shared helper hidden in a use-case file) is gone.
- **`platform/env/` is kept as is.** `next.config.ts` imports `src/server/platform/env/env` in plain Node, where `server-only` throws. The folder separates the `server-only` index from the definition for that reason.
- **The dashboard route keeps calling two modules.** It loads the user and passes `countUnlockedAchievements` into `getDashboardStats`; under the controller rule that is wiring, not business logic. A one-call alternative is the follow-up issue.

---

### Task 1: Platform: `config.ts`, `domain.ts`, auth session

**Files:** `src/server/platform/config/*` → `src/server/platform/config.ts`; `src/server/platform/domain/*` → `src/server/platform/domain.ts`; `src/server/platform/auth/session.ts` → into `src/server/platform/auth/auth.ts`; `src/server/platform/auth/index.ts`.

- [ ] **Step 1:** `git mv src/server/platform/config/game-config.ts src/server/platform/config.ts`. Prepend `import "server-only";`, append `RATE_LIMIT_TIERS` (from `rate-limits.ts`) and `OUTBOX_TUNING` (from `outbox.ts`) verbatim. `git rm` the rest of `config/`.
- [ ] **Step 2:** `git mv src/server/platform/domain/domain-error.ts src/server/platform/domain.ts`, prepend `import "server-only";`, `git rm src/server/platform/domain/index.ts`.
- [ ] **Step 3:** Append `getSessionUserId` from `session.ts` to `auth/auth.ts`, add `import "server-only";` and `import { headers } from "next/headers";` at the top, drop the now-internal `import { auth } from "./auth"`. `git rm auth/session.ts`. In `auth/index.ts`, export `getSessionUserId` from `./auth`.
- [ ] **Step 4:** Update `README.md` only if it names a moved path (it names `platform/env/env.ts`, which stays).
- [ ] **Step 5: Verify** eslint, typecheck, `npm run test:run`. Confirm `next.config.ts` still imports `./src/server/platform/env/env`.
- [ ] **Step 6: Commit** `refactor(platform): collapse config and domain into single files, merge session into auth`

### Task 2: Progression

**Files:** `src/server/progression/{get-player-state,record-activity,grant-xp,add-xp,replace-source-xp,revoke-source,events,index}.ts`; tests `get-player-state`, `grant-xp`, `record-activity`, `replace-source-xp`, `revoke-source`.

- [ ] **Step 1:** `git mv revoke-source.ts progression.service.ts` (largest), then merge `get-player-state`, `record-activity`, `grant-xp`, `add-xp`, `replace-source-xp` into it. `toPlayerState`, `addXp`, `settleLevelUp` and the `XpGrant` type become non-exported. `PlayerState` and `ActivityDays` stay exported.
- [ ] **Step 2:** `git mv events.ts progression.events.ts`.
- [ ] **Step 3:** `index.ts` exports the same names from `./progression.service`, `./progression.rules`, `./profile.repository`, `./xp-ledger.repository`.
- [ ] **Step 4:** Point the five use-case tests at `../progression.service`.
- [ ] **Step 5: Verify**, then **Commit** `refactor(progression): merge use cases into progression.service.ts`

### Task 3: Quests

**Files:** `src/server/quests/{claim-quest,get-quests,recount-quest-progress,sync-quests,update-quest-progress,index}.ts`; tests `recount-quest-progress`, `update-quest-progress`.

- [ ] **Step 1:** `git mv recount-quest-progress.ts quest.service.ts`, merge `claim-quest`, `get-quests`, `sync-quests`, `update-quest-progress`. Anything from `sync-quests` not exported by `index.ts` becomes private. `QuestMeasure` stays exported.
- [ ] **Step 2:** `index.ts` exports the same names from `./quest.service`, `./quest.definitions`, `./quest.rules`.
- [ ] **Step 3:** Point the two tests at `../quest.service`.
- [ ] **Step 4: Verify**, then **Commit** `refactor(quests): merge use cases into quest.service.ts`

### Task 4: Social

**Files:** `src/server/social/{send-friend-request,respond-to-request,remove-friend,list-friends,get-friend-records,events,index}.ts`.

- [ ] **Step 1:** `git mv respond-to-request.ts friendship.service.ts`, merge `send-friend-request`, `remove-friend`, `list-friends`, `get-friend-records`. `requirePendingRequestTo`, `otherParty`, `toProfiles` and `ALREADY_SENT` stay private. Keep one `import "./friendship.events";`.
- [ ] **Step 2:** `git mv events.ts friendship.events.ts`.
- [ ] **Step 3:** `index.ts` exports the same names from `./friendship.service` and `./friendship.rules`.
- [ ] **Step 4: Verify** (tests import `../index` and `../friendship.rules`; no test edits expected), then **Commit** `refactor(social): merge use cases into friendship.service.ts`

### Task 5: Achievements

**Files:** `src/server/achievements/{evaluate-achievements,list-achievements,events,index}.ts`.

- [ ] **Step 1:** `git mv evaluate-achievements.ts achievement.service.ts`, move `achievementListeners` out into a new `achievement.listeners.ts` (imports `evaluateAchievements` from `./achievement.service`), merge `list-achievements` into the service.
- [ ] **Step 2:** `git mv events.ts achievement.events.ts`; the service imports `./achievement.events`.
- [ ] **Step 3:** `index.ts` exports the same names from `./achievement.service` and `./achievement.listeners`.
- [ ] **Step 4: Verify**, then **Commit** `refactor(achievements): achievement.service.ts and achievement.listeners.ts`

### Task 6: Notification

**Files:** `src/server/notification/{list-notifications,mark-notifications-read,listeners,index}.ts`.

- [ ] **Step 1:** `git mv list-notifications.ts notification.service.ts`, merge `mark-notifications-read`.
- [ ] **Step 2:** `git mv listeners.ts notification.listeners.ts`.
- [ ] **Step 3:** Update `index.ts`.
- [ ] **Step 4: Verify**, then **Commit** `refactor(notification): notification.service.ts and notification.listeners.ts`

### Task 7: Training top level

**Files:** `src/server/training/{activity-days,quest-measure,date-queries,events,index}.ts`; `workouts/workout.repository.ts`, `runs/run.repository.ts` (import paths only), plus every training file importing these.

- [ ] **Step 1:** `git mv activity-days.ts training.adapters.ts`, append `questMeasure` from `quest-measure.ts`, `git rm quest-measure.ts`.
- [ ] **Step 2:** `git mv date-queries.ts dated.repository.ts`; update its two repository importers.
- [ ] **Step 3:** `git mv events.ts training.events.ts`.
- [ ] **Step 4: Verify**, then **Commit** `refactor(training): name the top-level training files by role`

### Task 8: Training workouts

**Files:** `src/server/training/workouts/{log-workout,update-workout,delete-workout,list-workouts,get-recent-workouts,get-workout-dates-in-range}.ts`; `training/index.ts`; tests `edit-delete-workout` (and `log-workout` if it imports by relative path).

- [ ] **Step 1:** `git mv log-workout.ts workout.service.ts`, merge the other five. `MAX_RECENT_WORKOUTS` stays a module constant.
- [ ] **Step 2:** `training/index.ts` exports the six names from `./workouts/workout.service`.
- [ ] **Step 3:** Point tests at `../workout.service`.
- [ ] **Step 4: Verify**, then **Commit** `refactor(training): merge workout use cases into workout.service.ts`

### Task 9: Training runs (with `getRunStats`)

**Files:** `src/server/training/runs/{log-run,update-run,delete-run,list-runs}.ts`, `src/server/training/records/get-run-stats.ts`; tests `edit-delete-run`, `log-run`, `records/__tests__/get-run-stats.test.ts`.

- [ ] **Step 1:** `git mv log-run.ts run.service.ts`, merge `update-run`, `delete-run`, `list-runs`, and `records/get-run-stats.ts` (with its `RunStats` type).
- [ ] **Step 2:** `git mv records/__tests__/get-run-stats.test.ts runs/__tests__/get-run-stats.test.ts`; point run tests at `../run.service`.
- [ ] **Step 3:** Update `training/index.ts`.
- [ ] **Step 4: Verify**, then **Commit** `refactor(training): merge run use cases and run stats into run.service.ts`

### Task 10: Training templates and exercises

**Files:** `src/server/training/templates/{create-workout-template,list-templates,delete-template}.ts`; `src/server/training/exercises/{create-custom-exercise,get-custom-exercises,exercise.rules}.ts`; tests `create-workout-template`, `create-custom-exercise`, `get-custom-exercises`.

- [ ] **Step 1:** `git mv create-workout-template.ts template.service.ts`, merge `list-templates`, `delete-template`.
- [ ] **Step 2:** `git mv create-custom-exercise.ts exercise.service.ts`, merge `get-custom-exercises`, and move `formatExerciseName` in as a private function. `git rm exercise.rules.ts`. Drop `formatExerciseName` from `training/index.ts` (nothing outside the folder imports it; verify with `grep -rn formatExerciseName src` before removing).
- [ ] **Step 3:** Update `training/index.ts` and the three tests.
- [ ] **Step 4: Verify**, then **Commit** `refactor(training): template.service.ts and exercise.service.ts`

### Task 11: Training stats

**Files:** `src/server/training/records/{get-personal-records,records.rules}.ts`, `src/server/training/dashboard/get-dashboard-stats.ts`; tests `get-personal-records`, `records.rules`, `get-dashboard-stats`.

- [ ] **Step 1:** `git mv dashboard/get-dashboard-stats.ts stats/stats.service.ts`, merge `records/get-personal-records.ts`.
- [ ] **Step 2:** `git mv records/records.rules.ts stats/stats.rules.ts`.
- [ ] **Step 3:** Move the three tests into `stats/__tests__/`, renaming `records.rules.test.ts` to `stats.rules.test.ts`; fix imports. `records/` and `dashboard/` are now empty and gone.
- [ ] **Step 4:** Update `training/index.ts`.
- [ ] **Step 5: Verify**, then **Commit** `refactor(training): records and dashboard become stats/`

### Task 12: AGENTS.md

**Files:** `AGENTS.md`.

- [ ] **Step 1:** In *File Architecture*, replace the layer table and its bullets with the current shape: the API route row describes `defineRoute` (auth, throttle, Zod, idempotency, errors); the service, domain and data rows point at `src/server/<module>/<noun>.{service,rules,repository}.ts`; keep a single line saying `src/lib/services`, `src/lib/domain` and `src/lib/data` hold features not yet moved.
- [ ] **Step 2:** Add the *Naming rule* and *Controllers* paragraphs from this plan.
- [ ] **Step 3:** Fix the stale `getAuthUserId`, `handleApiError`, `try/catch` and `src/lib/services/__tests__/log-workout.test.ts` references in *DRY*, *Request Validation*, *Centralized API Error Handling*, *MongoDB & Data Integrity*, *Routing* and *TDD* so they name `defineRoute`, `toErrorResponse`, `src/server/platform/http/errors.ts` and `src/server/training/workouts/__tests__/log-workout.test.ts`. Verify each named path exists.
- [ ] **Step 4: Commit** `docs: describe the server file layout and controller rule in AGENTS.md`

[[Plans Index]]
