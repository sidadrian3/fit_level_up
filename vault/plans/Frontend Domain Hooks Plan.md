# Frontend Domain Hooks Plan

> **For agentic workers:** each task below is one commit. Run `npx eslint <changed files> && npm run typecheck && npm run test:run` before handing a task back; the coordinator reviews and commits. Steps use checkbox (`- [ ]`) syntax for tracking.

**Step:** 4.1 in [[Architecture Overhaul Audit]] (F-19, §6.5). **Spec:** [[Architecture Overhaul Design Spec]] C1 (response types move to `src/shared/contracts/`; "4.1 retargets the imports"). **Baseline:** 464 tests in 66 files, all green, on `master` at `d7ecf69`.

## Problem Statement

Browser-side data access has no owner. Query keys are string literals typed into pages and components (`["workouts", page]`, `["runs-stats"]`, `["personal-records"]`, `["workoutTemplates"]`, `["user"]`), and each page carries its own hand-copied list of what to invalidate after a change. The lists have drifted: logging a workout invalidates `["user"]` inside `useEntityForm` and three more keys in the workouts page; deleting a workout invalidates four from the page; the runs page has its own five. Anyone who adds a new place that logs a workout has to rediscover the list.

Workout and run creates and edits don't go through `useMutation` at all: `useEntityForm` calls the fetch wrapper directly. The notification bell starts its fast-poll window from the mutation cache, so after a workout that levels you up, the level-up toast waits for the slow 30-second poll.

The custom-exercise query and mutation are copy-pasted between `WorkoutForm` and `CreateTemplateForm`. `UserContext` wraps a single query in a React context with a `refresh` function that nothing calls. Response types (`User`, `Workout`, `Run`, `Quest`, `FriendProfile`, …) are still defined in `src/lib/types.ts`, which 22 files under `src/server/` import. That breaks the rule that `src/lib/` is browser-only.

## Solution

Each front-end domain gets one folder, `src/lib/<domain>/`:

```
keys.ts     the domain's query-key table, the only place a key literal appears
api.ts      endpoint wrappers, moved from src/lib/data/api-client/<domain>.ts
hooks/      one hook per file: use<Thing>.ts (queries) and use<Verb><Thing>.ts (mutations)
utils/      only when the domain has client helpers (notifications today, progression's invalidation helper)
```

Every `useQuery` and `useMutation` moves into a domain hook. A mutation hook owns its invalidation: its own domain's keys, plus every other domain its server change affects. Workout and run create, update and delete share one helper, `invalidateActivityEffects`, in `lib/progression`, because `src/server/progression` owns what an activity changes (XP, level, streak, stamina, quest progress, personal records). Pages and components import hooks, never `@tanstack/react-query`. An ESLint rule enforces that at the end.

`useEntityForm` keeps field state, idempotency-key rotation and error text, and takes the domain mutations' `mutateAsync` as its `onCreate`/`onUpdate`. Workout and run requests then go through `useMutation`, so the notification fast-poll fires after them. `UserContext` becomes `useCurrentUser()` plus a `<SessionGuard />` mounted once. Each domain's response types move to `src/shared/contracts/`, and every importer is pointed at them.

Achievements and dashboard stats stay server-rendered (§6.5). Dashboard and profile are `force-dynamic` pages, which the Next 16 client cache doesn't keep for forward navigation (`staleTimes.dynamic` is 0), so they render fresh. Browser Back reuses the cached page and can show numbers from before the last log, so that goes into [[Known Issues]]. React Query can't reach it.

The work ships as nine stacked PRs, each reviewed and fixed before the next is built:

```
master (d7ecf69)
 └ refactor/fe-hooks-progression        PR 1  Tasks 1–5
    └ refactor/fe-hooks-quests           PR 2  Tasks 6–7
       └ refactor/fe-hooks-friends        PR 3  Tasks 8–9
          └ refactor/fe-hooks-notifications PR 4  Task 10
             └ refactor/fe-hooks-exercises  PR 5  Tasks 11–12
                └ refactor/fe-hooks-templates PR 6  Tasks 13–14
                   └ refactor/fe-hooks-workouts PR 7  Tasks 15–18
                      └ refactor/fe-hooks-runs    PR 8  Tasks 19–20
                         └ refactor/fe-hooks-achievements-cleanup PR 9  Tasks 21–23
```

## Commits

### PR 1 — progression

#### Task 1: Playwright runs on a configurable port and the journey matches today's form

The journey can't pass today: it clicks `button:has-text("Cardio")` and fills `input[placeholder="Exercise name"]`, and `WorkoutForm` has neither. On this machine port 3000 serves another project, and `reuseExistingServer` would test it.

- [ ] `playwright.config.ts`: read `PLAYWRIGHT_PORT` (default `3000`) into `baseURL`, `webServer.url` and `webServer.command` (`npm run dev -- --port <port>`).
- [ ] `tests/e2e/user-journey.spec.ts`: rewrite the workout step against the current `WorkoutForm` (title, exercise picker, Log Workout). Keep its assertion: the card with the title appears in the history.
- [ ] Run with `PLAYWRIGHT_PORT=3100 npm run test:e2e`; it passes against the shared Atlas dev database with a throwaway account.

Commit: `test(e2e): configurable Playwright port and a journey that matches the workout form`.

#### Task 2: Characterize cross-screen refresh

Both tests pass on today's code. They pin the behaviour every later task must keep. Navigation between screens uses the sidebar links (client-side), never `page.goto`, so the React Query cache survives between steps the way it does for a person.

- [ ] **Activity refreshes other screens** (new test in the same spec file, its own throwaway account):
  1. Open `/quests` and read the progress of the daily quest that counts workouts.
  2. Go to `/workouts` and log a workout. The sidebar's `<xp> / <xpToNextLevel> XP` changes without a reload.
  3. Go to `/quests` by the sidebar link. That quest's progress went up by one.
  4. Go to `/runs` and log a run. The Total Runs stat card goes from 0 to 1, and the sidebar XP changes again.
  5. Go to `/profile`. Personal Records shows an entry from the logged workout or run.
  6. Back on `/workouts`, delete the workout. It leaves the list and the sidebar XP drops.
- [ ] **Template and custom exercise** (new test): on `/templates/new` create a custom exercise through its modal, see it in the exercise picker, save a template that uses it, then on `/workouts` open "Start from Template" and see the template listed.
- [ ] Prefer role and text locators over CSS. Where a value has no stable locator, add none; read it from visible text.

Commit: `test(e2e): characterize cross-screen refresh after logging and templates`.

#### Task 3: `apiFetch` moves to `src/lib/shared/`

Moving it first means every new `api.ts` imports its final path once.

- [ ] `git mv src/lib/data/api-client/api-fetch.ts src/lib/shared/api-fetch.ts`, and move its test to `src/lib/shared/__tests__/api-fetch.test.ts`.
- [ ] Point every importer at `@/lib/shared/api-fetch`: the remaining `api-client/*.ts` files, `UserContext`, and the barrel's `ApiError`/`isIdempotencyKeyReused` re-export.

Commit: `refactor(api-client): apiFetch moves to lib/shared`.

#### Task 4: `User` moves to shared contracts

- [ ] Move `User` from `src/lib/types.ts` to `src/shared/contracts/user.ts`. `DateString` is used only by the types being moved, so each move inlines it as `string` with the existing comment kept where it explains a format (`date` is a full instant, `joinDate` is date-only).
- [ ] Point all 8 importers, server and client, at `@/shared/contracts/user`. `lib/types.ts` stops exporting `User`, with no re-export.

Commit: `refactor(progression): User type moves to shared contracts`.

#### Task 5: `useCurrentUser` and `progressionKeys` replace `UserContext`

- [ ] `src/lib/progression/keys.ts`: `progressionKeys = { all: ["progression"], current: () => [...all, "current"] }`, `as const`.
- [ ] `src/lib/progression/api.ts`: `getCurrentUser()`, moved from `api-client/user.ts`. Delete that file and its barrel line.
- [ ] `src/lib/progression/hooks/useCurrentUser.ts`: `useQuery<User>({ queryKey: progressionKeys.current(), queryFn: getCurrentUser, retry: false })`, returning `{ user: User | null, loading, error }`.
- [ ] `src/components/auth/SessionGuard.tsx`: calls `useCurrentUser()` and runs today's effect (log, then sign out and go to `/login` on "User not found" or "Unauthorized"). Renders nothing. `(app)/layout.tsx` mounts it once in place of `UserProvider`.
- [ ] `Sidebar`, `AddFriendSection`, `LevelUpManager` and `useActivityDateFormatter` switch from `useUser()` to `useCurrentUser()`. Delete `src/lib/context/`.
- [ ] Every `["user"]` invalidation becomes `progressionKeys.all` in this same commit: `useEntityForm` (both places), the workouts and runs pages' delete mutations, the quests page's claim.

Commit: `refactor(progression): useCurrentUser and progressionKeys replace UserContext`.

### PR 2 — quests

#### Task 6: Quest types move

- [ ] `Quest` and `QuestCategory` → new `src/shared/contracts/quest.ts`.
- [ ] `QuestMetric` and `QuestActivity` are server-only. They move into `src/server/quests/quest.rules.ts` as exports, and `quest.service.ts`, `quest.definitions.ts` and the recount test import them from there.
- [ ] Point every importer. `lib/types.ts` loses all four.

Commit: `refactor(quests): quest types move to shared contracts and the quests module`.

#### Task 7: Quest hooks

- [ ] `lib/quests/keys.ts`: `questKeys = { all: ["quests"], list: () => [...all, "list"] }`.
- [ ] `lib/quests/api.ts`: `getQuests`, `claimQuest`, moved. Delete `api-client/quests.ts` and its barrel line.
- [ ] `lib/quests/hooks/useQuests.ts` and `useClaimQuest.ts`. Claim invalidates `questKeys.all` and `progressionKeys.all` and awaits both, as today.
- [ ] The quests page uses the two hooks and stops importing React Query.
- [ ] The workouts and runs pages' `["quests"]` literals become `questKeys.all` in this commit.

Commit: `refactor(quests): quest hooks own keys and claim invalidation`.

### PR 3 — friends

#### Task 8: Friendship types move

- [ ] `FriendProfile`, `Friendship`, `FriendshipStatus` → `src/shared/contracts/friendship.ts` (it already holds `SendFriendRequestSchema`). Point every importer.

Commit: `refactor(friends): friendship types move to shared contracts`.

#### Task 9: Friend hooks

- [ ] `lib/friends/keys.ts`: `friendKeys = { all: ["friends"], list: () => [...all, "list"], requests: () => [...all, "requests"], records: (friendId: string) => [...all, "records", friendId] }`.
- [ ] `lib/friends/api.ts`: every wrapper from `api-client/friends.ts`, moved. Delete it and its barrel line.
- [ ] Hooks: `useFriends`, `useFriendRequests`, `useFriendRecords(friendId: string | null)` (disabled while null; the key factory is only called with a string), `useSendFriendRequest`, `useAcceptFriendRequest`, `useDeclineFriendRequest`, `useRemoveFriend`.
- [ ] Invalidation keeps today's sets: accept → `friendKeys.all`; decline → `friendKeys.requests()`; remove → `friendKeys.all`; send → none (outgoing requests aren't shown). Mutations keep their `console.error` on failure.
- [ ] The friends page and `FriendProfileModal` use the hooks. `isPending`/`variables` stay available for the per-card spinners.
- [ ] `useNotifications`'s `["friends"]` literal becomes `friendKeys.all` in this commit.

Commit: `refactor(friends): friend hooks own keys and invalidation`.

### PR 4 — notifications

#### Task 10: Notifications folder takes the domain shape

- [ ] `lib/notifications/keys.ts`: `notificationKeys = { all: ["notifications"], feed: () => [...all, "feed"], markRead: () => [...all, "read"] }`. The feed query uses `feed()`, the mark-read mutation uses `markRead()` as its `mutationKey`, and the mutation-cache filter skips mutations whose key starts with `notificationKeys.all[0]`.
- [ ] `lib/notifications/api.ts`: `getNotifications`, `markNotificationsRead`, moved. Delete `api-client/notifications.ts` and its barrel line.
- [ ] `useNotifications.ts` → `hooks/`. `notification-feed.ts` and `constants.ts` → `utils/`, and their test → `utils/__tests__/`. `NotificationProvider` updates its import.
- [ ] No behaviour change: the poll interval, fast window, toast rule and optimistic mark-read stay byte-for-byte except for imports and keys.

Commit: `refactor(notifications): keys table, api and hooks/utils folders`.

### PR 5 — exercises

#### Task 11: `CustomExercise` moves; `Exercise` and `TargetMuscle` importers are pointed at their contract

- [ ] `CustomExercise` → `src/shared/contracts/exercise.ts`.
- [ ] Every import of `Exercise`, `TargetMuscle` or `CustomExercise` from `@/lib/types` goes to `@/shared/contracts/exercise` (about 16 files). `lib/types.ts` drops its re-export of the first two.

Commit: `refactor(exercises): exercise types import from shared contracts`.

#### Task 12: One custom-exercise hook pair for both forms

- [ ] `lib/exercises/keys.ts`: `exerciseKeys = { all: ["exercises"], custom: () => [...all, "custom"] }`.
- [ ] `lib/exercises/api.ts`: `fetchCustomExercises`, `createCustomExercise`, moved. Delete `api-client/exercises.ts` and its barrel line.
- [ ] `hooks/useCustomExercises.ts` and `hooks/useCreateCustomExercise.ts` (invalidates `exerciseKeys.all`).
- [ ] `WorkoutForm` and `CreateTemplateForm` replace their copied query and mutation with the two hooks. This also does 4.2's "shared custom-exercise hook" item.

Commit: `refactor(exercises): one custom-exercise hook pair for both forms`.

### PR 6 — templates

#### Task 13: Template types move

- [ ] `WorkoutTemplate`, `CreateWorkoutTemplateInput` → `src/shared/contracts/template.ts`. Point every importer, including `api-client/workout-templates.ts`'s relative `../../types` import.

Commit: `refactor(templates): template types move to shared contracts`.

#### Task 14: Template hooks

- [ ] `lib/templates/keys.ts`: `templateKeys = { all: ["templates"], list: () => [...all, "list"] }`.
- [ ] `lib/templates/api.ts`: moved from `api-client/workout-templates.ts`. Delete it and its barrel line.
- [ ] `useWorkoutTemplates({ enabled })`, `useCreateWorkoutTemplate`, `useDeleteWorkoutTemplate`. Create invalidates `templateKeys.all` on success **and** on an `isIdempotencyKeyReused` error, matching today. Delete invalidates on success.
- [ ] `CreateTemplateForm` calls `useCreateWorkoutTemplate().mutateAsync`. It keeps its own `isSubmitting`, validation messages, key rotation on reuse and `router.push("/workouts")`. `TemplateSelectorModal` uses the list and delete hooks.

Commit: `refactor(templates): template hooks own keys and invalidation`.

### PR 7 — workouts and stats

#### Task 15: Workout, pagination and dashboard-stats types move

- [ ] `Workout`, `CreateWorkoutInput` → `src/shared/contracts/workout.ts`. `PaginatedResponse` → `src/shared/contracts/pagination.ts`. `DashboardStats` → new `src/shared/contracts/stats.ts`. Point every importer.

Commit: `refactor(workouts): workout, pagination and stats types move to shared contracts`.

#### Task 16: Stats domain for personal records

- [ ] `lib/stats/keys.ts`: `statsKeys = { all: ["stats"], personalRecords: () => [...all, "personal-records"] }`. Named after `src/server/training/stats/`.
- [ ] `lib/stats/api.ts`: `getPersonalRecords`, moved. Delete the unused `getDashboardStats` wrapper and `api-client/stats.ts`, and its barrel line.
- [ ] `hooks/usePersonalRecords.ts`. `PersonalRecords` uses it.
- [ ] The workouts and runs pages' `["personal-records"]` literals become `statsKeys.all` in this commit.

Commit: `refactor(stats): personal-records hook and statsKeys`.

#### Task 17: `invalidateActivityEffects`

- [ ] `lib/progression/utils/invalidate-activity-effects.ts`: `invalidateActivityEffects(queryClient)` invalidates `progressionKeys.all`, `questKeys.all` and `statsKeys.all` and returns the `Promise.all` of the three.
- [ ] The workouts and runs pages' delete `onSuccess` and `handleEditComplete` replace their three-key lists with it. Their own `["workouts"]`, `["runs"]` and `["runs-stats"]` literals stay until Tasks 18 and 20.

Commit: `refactor(progression): one helper for what an activity change invalidates`.

#### Task 18: Workout hooks

- [ ] `lib/workouts/keys.ts`: `workoutKeys = { all: ["workouts"], list: (page: number, limit: number) => [...all, "list", { page, limit }] }`.
- [ ] `lib/workouts/api.ts`: moved from `api-client/workouts.ts`. Delete it and its barrel line.
- [ ] `useWorkouts(page, limit)`, `useLogWorkout`, `useUpdateWorkout`, `useDeleteWorkout`. Each mutation invalidates `workoutKeys.all` and calls `invalidateActivityEffects` on success. `useLogWorkout` does both on an `isIdempotencyKeyReused` error too, because the server did record the workout.
- [ ] `WorkoutForm` passes `useLogWorkout().mutateAsync` and `useUpdateWorkout().mutateAsync` as `onCreate`/`onUpdate`. The trim-and-filter input shaping stays in the form.
- [ ] The workouts page uses `useWorkouts(page, 4)` and `useDeleteWorkout`. `handleEditComplete` only clears `editingId`. `MuscleHeatmap` uses `useWorkouts(1, 30)`.
- [ ] `useEntityForm` still invalidates `progressionKeys.all` until Task 20, because `RunForm` still depends on it. For workouts that call is redundant and harmless.

Commit: `refactor(workouts): workout hooks own keys and activity invalidation`.

### PR 8 — runs

#### Task 19: Run types move

- [ ] `Run`, `CreateRunInput` → `src/shared/contracts/run.ts`. Point every importer.

Commit: `refactor(runs): run types move to shared contracts`.

#### Task 20: Run hooks; `useEntityForm` leaves React Query

- [ ] `lib/runs/keys.ts`: `runKeys = { all: ["runs"], list: (page, limit) => [...all, "list", { page, limit }], stats: () => [...all, "stats"] }`. `["runs-stats"]` is gone.
- [ ] `lib/runs/api.ts`: moved from `api-client/runs.ts`. Delete it and its barrel line.
- [ ] `useRuns(page, limit)`, `useRunStats`, `useLogRun`, `useUpdateRun`, `useDeleteRun`, with the same invalidation shape as workouts (`runKeys.all` plus `invalidateActivityEffects`, on success and on the reuse error for log).
- [ ] `RunForm` and the runs page use them. `handleEditComplete` only clears `editingId`.
- [ ] `useEntityForm` drops `useQueryClient` and both invalidations. Its options, return value, key rotation and error text don't change.

Commit: `refactor(runs): run hooks own keys and activity invalidation`.

### PR 9 — achievements and cleanup

#### Task 21: Achievement type moves; old client folders go

- [ ] `Achievement` → new `src/shared/contracts/achievement.ts`. Point every importer.
- [ ] Delete the unused `api-client/achievements.ts`, the barrel `api-client/index.ts` and the now-empty `src/lib/data/api-client/`, and `src/lib/types.ts` once it exports nothing. Any leftover importer means an earlier task missed one; fix it here.

Commit: `refactor(achievements): achievement type moves; old api-client and lib/types removed`.

#### Task 22: Lint rule keeps React Query inside `src/lib`

- [ ] `eslint.config.mjs`: for `src/app/**` and `src/components/**` (ignoring `src/components/providers/QueryProvider.tsx`), `no-restricted-imports` adds `@tanstack/react-query` with the message "Use a hook from @/lib/<domain>/hooks." The entry repeats `entryOnlyPatterns`, because overlapping `no-restricted-imports` entries replace each other.
- [ ] `npx eslint src` passes.
- [ ] `AGENTS.md`: the React Query section's "endpoint wrapper in `src/lib/data/api-client/<domain>.ts`" and Shared Type Definitions' "lives in `src/lib/types.ts`" now point at `src/lib/<domain>/api.ts` + `keys.ts` + `hooks/` and `src/shared/contracts/`. Only the lines this refactor made untrue change; 5.1 still owns the wider sync.

Commit: `refactor(lint): pages and components reach React Query only through domain hooks`.

#### Task 23: Known issue for Back-button staleness

- [ ] `vault/checklist/Known Issues.md`: new section. Browser Back to `/dashboard` or `/profile` after logging shows the cached Server Component payload until the next forward navigation or reload. Fix candidates: `router.refresh()` when those pages mount from history, or moving their numbers to client queries (contradicts §6.5).

Commit: `docs(vault): known issue for server-rendered pages after Back`.

After Task 23, the coordinator runs the handbook sync and writes the history log on this branch.

## Decision Document

- **Domain folder shape:** `keys.ts`, `api.ts`, `hooks/`, and `utils/` only where it has content. No `types/` folder, because response types live in `src/shared/contracts/` (spec C1). A type only the browser uses stays in the file that uses it.
- **Hook files:** one hook per file, camelCase like `useEntityForm.ts`, so the path to any hook is predictable from its name.
- **Keys tables:** plain `as const` objects, hierarchical so `.all` invalidates the whole domain. Queries use the narrowest entry; invalidations use `.all` unless a narrower key is clearly enough (decline → requests). Mutation keys come from the table too. `queryOptions()` factories were rejected: every query has exactly one hook, so they'd add weight with no current caller.
- **Key renames are safe:** the cache isn't persisted, so `["user"]`, `["runs-stats"]`, `["customExercises"]`, `["workoutTemplates"]` and `["personal-records"]` disappear without migration. Every reader and writer of a key changes in the same commit.
- **Cross-domain invalidation:** workout and run create, update and delete call `invalidateActivityEffects` (progression, quests, stats). Quest claim invalidates quests and progression. An idempotent replay (`isIdempotencyKeyReused`) invalidates the same set as success, because the server recorded the change.
- **Client dependency direction:** workouts, runs and quests import `lib/progression`, `lib/quests` and `lib/stats` keys. Progression's helper imports quest and stats keys. Nothing in `lib/<domain>` imports a component.
- **`useEntityForm`:** keeps state, `isSubmitting`, key rotation and error text, and takes `mutateAsync` functions. Rejected: passing it the mutation objects and reading `isPending`, which is a larger change to a hook two forms rely on, for no visible gain.
- **`UserContext`:** replaced by `useCurrentUser()` and a `<SessionGuard />` mounted once. React Query already dedupes the query; mounting the effect once stops the sign-out from firing per caller. `refresh` had no caller and is dropped.
- **Achievements and dashboard stats:** stay server-rendered, with no keys table. Their dead client wrappers are deleted. Back-button staleness is a known issue.
- **Response types:** each PR moves its own domain's types and points every importer at them, server and client. Server-only quest types go to the quests module, not shared contracts. `src/lib/types.ts` is deleted at the end.
- **`apiFetch`** moves to `src/lib/shared/api-fetch.ts` first (Task 3), not last, so each new `api.ts` is written once against its final import. Its name and behaviour don't change.
- **Enforcement:** an ESLint `no-restricted-imports` entry stops `src/app` and `src/components` (except `QueryProvider`) from importing `@tanstack/react-query`.
- **PRs:** nine stacked branches from `master`. Each PR is reviewed (`code-review` against the branch below) and its findings fixed before the next branch is built. PR descriptions are plain prose with no attribution footer.

## Testing Decisions

- A good test here drives the real app the way a person does and asserts what's on screen. It never asserts which keys were invalidated, because that would only restate the keys tables.
- Vitest runs in `node` with no DOM, so hooks get no unit tests. Adding jsdom and Testing Library was rejected for this refactor.
- The Playwright journey (Tasks 1–2) is the characterization suite. It passes on today's code before any production change, and at the tip of every PR. Prior art: `tests/e2e/user-journey.spec.ts`.
- Runs use `PLAYWRIGHT_PORT=3100` against the shared Atlas dev database with throwaway accounts (random emails). There's no account-delete route, so accounts are left behind, as before.
- The moved `apiFetch` and `notification-feed` unit tests move with their files. `npm run test:run` stays at 464 tests throughout; the Playwright suite goes from 1 to 3 tests.
- Every commit passes `eslint`, `depcruise`, `typecheck` and `test:run` (the pre-commit hook).

## Out of Scope

- Moving page-scoped components into `app/(app)/<page>/_components/`, and splitting `WorkoutForm` (step 4.2).
- Server-side changes beyond import retargeting for moved types. API routes, including the now client-unused `/api/achievements` and `/api/stats/dashboard`, stay.
- `QueryProvider` defaults (`staleTime` 5 minutes).
- Renaming `apiFetch` into `getJson`/`postJson` helpers (audit §6.1 sketch).
- Fixing Back-button staleness on server-rendered pages (recorded in Known Issues).
- The wider `AGENTS.md` and vault sync for the new architecture (step 5.1).

## Further Notes

- Riskiest part: Tasks 18 and 20, where `useEntityForm`'s create path meets `useMutation`. The idempotency key must still rotate exactly once after a success, and the "already saved" path must still call `onAlreadySaved`, rotate, and refresh the screens.
- Workout and run logs now open the notification fast-poll window: a few extra 2-second polls for 10 seconds after each log. That's the intended "stale data now refreshes" change.
- `invalidateActivityEffects` sits in `lib/progression` but imports quest and stats keys. The arrow points the same way as on the server, where progression owns activity side-effects.

## Amendments During Build

Decisions that changed the plan while the nine PRs were built, each with its reason:

- **`invalidateActivityEffects(queryClient)` became `invalidateActivityChange(queryClient, activityKey)`** (PR 7 review). Three workout hooks repeated the same two-line invalidation and the run hooks would have added three more, so the helper now also invalidates the activity's own key. Tasks 17, 18 and 20 above describe the earlier name.
- **The workout, run and quest-claim mutation hooks return their invalidation promise** so `mutateAsync` waits until the screens are fresh. `useEntityForm` used to await the progression refetch itself; the wait moved into the mutations when Task 20 took React Query out of it. The form stays busy slightly longer than before.
- **The custom-exercise wrappers moved from raw `fetch()` to `apiFetch`** (Task 12), because the repo rules forbid raw `fetch`. The error text falls back to "Request failed: <url>" when the server sends none, and the list load retries on a network error like other GET calls.
- **Create-input types are inferred from their Zod schemas** (`CreateCustomExerciseInput`, `CreateWorkoutTemplateInput`, `CreateWorkoutInput`, `CreateRunInput`) instead of being moved as hand-written types, so a schema change cannot drift from the type.
- **`RunStats` joined `src/shared/contracts/run.ts`**, and the run service imports it, replacing its own copy of the same type (Task 20).
- **`useFriendRecords(friendId)` uses `skipToken`** and builds its key with an empty string while the modal is closed, so the key factory only ever receives a string. Real ids are 24-character hex, so the key cannot collide.
- **`removeFriend` is typed `{ success: boolean }`**, which is what the server returns; it was typed `{ success: true }`.
- **`stats` became a tenth client domain** (Task 16) for personal records, named after `src/server/training/stats/`.
- **Task 2's quest check reads Weekly Consistency**, because Daily Burn swaps its progress text for a Claim button after one workout.
- **Playwright runs on `PLAYWRIGHT_PORT`**, and the config passes `NEXT_PUBLIC_BETTER_AUTH_URL` so signup follows the port (Task 1). `package.json` still pins `@playwright/test` to `^1.61.1` while `playwright` is `^1.64.1`; that mismatch was left alone.

[[Plans Index]]
