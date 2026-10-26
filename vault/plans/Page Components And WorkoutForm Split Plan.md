# Page Components And WorkoutForm Split Plan

> **For agentic workers:** each task below is one commit. Run `npx eslint <changed files> && npm run typecheck && npm run test:run` before handing a task back; the coordinator reviews and commits. Steps use checkbox (`- [ ]`) syntax for tracking.

**Step:** 4.2 in [[Architecture Overhaul Audit]] (F-19, §6.1, §6.5). **Follows:** [[Frontend Domain Hooks Plan]]. **Baseline:** 464 tests in 66 files, all green, on `master` at `c9ff064`.

## Problem Statement

`src/components/` is organised by feature, but almost every feature folder serves exactly one page: `dashboard/` is imported only by the dashboard page, `friends/` only by the friends page, and so on. To change a page you open its `page.tsx` in `src/app` and then go hunting in a parallel tree. The folder also mixes three kinds of thing that §6.1 keeps apart: the Modern Athletic primitives, the app shell rendered on every page (sidebar, mobile tabs, notifications, session guard), and components that belong to one screen.

`WorkoutForm` is 468 lines and does four jobs: it builds the exercise catalog (predefined plus custom, sorted, grouped by muscle), owns the form state and submit, renders each exercise row with its focus-tracking inputs, and computes and draws the Live Pump Tracker. The catalog code (merge, group, look up by name, create a custom exercise and add it to the list) is copied in `CreateTemplateForm`, as is the empty-exercise default.

The copies have already drifted: `WorkoutForm` adds a newly created custom exercise with the default `Chest` target muscle, while `CreateTemplateForm` uses the muscle the person chose. A custom Legs exercise logged from the workout form counts as chest volume.

## Solution

`src/components/` keeps two folders:

```
ui/       Modern Athletic primitives, untouched
shared/   components rendered on more than one page
  auth/           SessionGuard, TimeZoneSync
  layout/         MobileTabs, PageHeader, Sidebar, sidebar/*
  notifications/  bell, center, menu, panel, provider, toasts, level-up, presentation helpers
  providers/      QueryProvider
  exercises/      CreateExerciseModal
```

Every component used by one page moves next to it, into the page's private `_components/` folder (underscore folders are left out of routing, per the Next 16 project-structure guide): dashboard, friends, profile, quests, runs, workouts, and `templates/new`.

A new hook, `useExerciseCatalog`, in `lib/exercises/hooks/`, owns the catalog that both forms need: it reads custom exercises, merges and sorts them with the predefined list, groups them by target muscle, looks one up by name, and creates a custom exercise. The empty-exercise default moves to `lib/constants/exercises.ts`.

`WorkoutForm` splits into three files in `workouts/_components/`:

- `WorkoutForm` — form state through `useEntityForm`, validation and submit, the header, title, duration and buttons, and the two modals.
- `WorkoutExerciseRow` — one exercise: the grouped picker and the sets, reps and weight inputs, reporting changes as a patch and focus as the row's target muscle.
- `LivePumpTracker` — turns the current exercises into muscle intensities and draws the anatomy model.

Form state stays in `WorkoutForm`; it has one caller and is mostly `useEntityForm` configuration, so a separate hook would only add a file to read alongside it.

Dependency-cruiser rule G3 (UI code reaches `src/server` only for types) extends to `src/app/**/_components/`, so the moved components keep the guard they have today. Finally, a separate fix commit makes the workout form keep the custom exercise's target muscle.

## Commits

### Task 1: App shell and cross-page components move to `components/shared/`

- [ ] `git mv` `components/{auth,layout,notifications,providers}` to `components/shared/{auth,layout,notifications,providers}`, and `components/workouts/CreateExerciseModal.tsx` to `components/shared/exercises/`.
- [ ] Point every importer at the new paths: `app/layout.tsx`, `app/(app)/layout.tsx`, every page and `loading.tsx` that imports `PageHeader`, `SidebarUserProfile` (imports `NotificationMenu`), `WorkoutForm` and `CreateTemplateForm` (import the modal). Relative imports inside `notifications/` and `layout/sidebar/` stay as they are.
- [ ] `eslint.config.mjs`: the React Query ban's ignore path becomes `src/components/shared/providers/QueryProvider.tsx`.
- [ ] `.dependency-cruiser.cjs` G3: `from.path` also matches `^src/app/.*/_components/`; the comment names page components.
- [ ] `npm run lint` passes (depcruise included).

Commit: `refactor(ui): move app-shell and cross-page components to components/shared`.

### Task 2: Dashboard components move to `dashboard/_components/`

- [ ] `git mv` `ActivityTracker`, `DailyQuests`, `DashboardTabs`, `MuscleHeatmap`, `RecentActivity`, `XPCard` to `app/(app)/dashboard/_components/`.
- [ ] `page.tsx` imports `./_components/<Name>`. `MuscleHeatmap`'s `../ui/AnatomyModel` becomes `@/components/ui/AnatomyModel`.

Commit: `refactor(dashboard): colocate dashboard components with the page`.

### Task 3: Friends components move to `friends/_components/`

- [ ] `git mv` `AddFriendSection`, `FriendCard`, `FriendProfileModal`, `FriendRequestCard`; `page.tsx` imports `./_components/<Name>`.

Commit: `refactor(friends): colocate friends components with the page`.

### Task 4: Profile components move to `profile/_components/`

- [ ] `git mv` `AchievementGrid`, `PersonalRecords`, `ProfileHeader`; `page.tsx` imports `./_components/<Name>`.

Commit: `refactor(profile): colocate profile components with the page`.

### Task 5: Quest components move to `quests/_components/`

- [ ] `git mv` `QuestSection`, `QuestCard`; `page.tsx` imports `./_components/QuestSection`.

Commit: `refactor(quests): colocate quest components with the page`.

### Task 6: Run components move to `runs/_components/`

- [ ] `git mv` `RunCard`, `RunForm`; `page.tsx` imports `./_components/<Name>`.

Commit: `refactor(runs): colocate run components with the page`.

### Task 7: Workout and template components move next to their pages

- [ ] `git mv` `WorkoutCard`, `WorkoutForm`, `TemplateSelectorModal` to `app/(app)/workouts/_components/`, and `CreateTemplateForm` to `app/(app)/templates/new/_components/`.
- [ ] Pages import `./_components/<Name>`. `WorkoutForm`'s `../ui/AnatomyModel` becomes `@/components/ui/AnatomyModel`.
- [ ] `src/components/` now holds only `ui/` and `shared/`.
- [ ] `npm run test:e2e` passes.

Commit: `refactor(workouts): colocate workout and template components with their pages`.

### Task 8: `useExerciseCatalog` replaces the catalog code copied in both forms

- [ ] `lib/constants/exercises.ts` exports `EMPTY_EXERCISE` (`as const`-typed `Exercise`: Chest, 3 sets, 10 reps, bodyweight). Both forms use it and drop their local `emptyExercise`.
- [ ] `lib/exercises/hooks/useExerciseCatalog.ts` returns `{ exercises, exerciseGroups, findExercise, createCustomExercise }`. `exercises` is the merged, sorted list; `exerciseGroups` keeps today's shape and order (every `TargetMuscle` in enum order, then `Other`, empty groups included so callers skip them as now); `findExercise(name)` returns the entry or `undefined`; `createCustomExercise(input)` resolves to the created `CustomExercise`. Both values are memoised as today.
- [ ] `WorkoutForm` and `CreateTemplateForm` use the hook in place of `useCustomExercises`, `useCreateCustomExercise`, `mergeAndSortExercises` and their grouping `useMemo`. Each form keeps its own "add the new exercise, replacing a single empty row" update, unchanged, so the `Chest` difference survives this commit.
- [ ] No other file uses `useCustomExercises` or `useCreateCustomExercise` directly; both hooks stay, as the catalog's building blocks.

Commit: `refactor(exercises): one exercise-catalog hook for the workout and template forms`.

### Task 9: `WorkoutForm` splits into a shell, `WorkoutExerciseRow` and `LivePumpTracker`

- [ ] `workouts/_components/LivePumpTracker.tsx` takes `exercises` and `activeMuscle`, memoises the intensities exactly as today (named exercises only, one-day window, now) and renders the right-hand panel with today's markup.
- [ ] `workouts/_components/WorkoutExerciseRow.tsx` takes `exercise`, the catalog's `exerciseGroups` and `findExercise`, `onChange(patch)`, an optional `onRemove` (absent when only one row is left) and `onFocusMuscle(muscle)`. Its picker keeps today's semantics: focusing a named row reports that exercise's catalog muscle; choosing an exercise sets name and target muscle and reports the muscle; choosing the empty value clears only the name. Sets, reps and weight parse as today and report focus only when the row is named. The input class string becomes a module-level `workoutInputClass` exported from the row file; `WorkoutForm`, which already depends on the row, imports it for the title and duration inputs instead of keeping a second copy.
- [ ] `WorkoutForm` renders `<WorkoutExerciseRow key={index} …>` per exercise; `updateExercise(index, patch)` merges a patch. Markup and class names are byte-for-byte the same as before the split.
- [ ] `npm run test:e2e` passes.

Commit: `refactor(workouts): split WorkoutForm into the form, an exercise row and the pump tracker`.

### Task 10: A custom exercise created in the workout form keeps its target muscle

Not a refactor; its own commit after the refactor commits.

- [ ] Failing e2e test first, in `user-journey.spec.ts`: on `/workouts`, open Create Custom, name an exercise, pick Legs, create it, log the workout, and the new card reads "Legs Day". Today it reads "Chest Day".
- [ ] `WorkoutForm`'s custom-exercise handler adds the new row with the created exercise's `targetMuscle`, as `CreateTemplateForm` does. The test passes.

Commit: `fix(workouts): a custom exercise created while logging keeps its target muscle`.

## Decision Document

- **Two component homes.** `components/ui/` holds the Modern Athletic primitives and is not touched. `components/shared/` holds whatever more than one page renders, including the app shell mounted by the `(app)` layout and the root layout's query provider. Feature subfolders are kept inside `shared/` so the shell's relative imports and its grouping survive.
- **Page components live in the page's `_components/`.** A component used by one page sits next to it; a second page using it moves it to `shared/`.
- **`CreateExerciseModal` is shared**, under `shared/exercises/`, because the workout and template pages both render it.
- **`useExerciseCatalog`** is the one browser-side owner of the exercise catalog. It composes the existing custom-exercise query and mutation hooks, so caching and invalidation are unchanged and no new request is made.
- **`WorkoutForm` keeps its form state.** The split is by what renders: one row, the tracker, and the form that composes them.
- **`CreateTemplateForm` keeps its own row markup.** Its rows are styled differently (larger padding and radius, aria-labels, no muscle tracking); a shared row would change one form's UI.
- **G3 covers page components.** The UI-to-server import guard follows the components into `src/app/**/_components/`.
- **The target-muscle bug is fixed separately**, after the refactor, with an e2e test that fails first.

## Testing Decisions

- The refactor's behaviour is pinned by the Playwright user journey (workout logging, cross-screen refresh, custom exercise in a template, template offered when starting a workout) plus typecheck and lint for every moved import. Vitest runs in a `node` environment with no component-testing library, so there are no component tests to move or add.
- `useExerciseCatalog` gets no unit test of its own: it is a merge, a sort and a grouping over existing hooks, and the journey's custom-exercise test exercises it through both forms.
- The fix gets one e2e test that observes the stored muscle through the workout card's "<Muscle> Day" focus label, the same approach as the journey's existing card assertions.
- `npm run test:run` stays at 464 passing after every task; `npm run test:e2e` runs after Tasks 7, 9 and 10.

## Out of Scope

- `components/ui/` and the design tokens.
- Splitting `NotificationPanel` (235 lines), `RunForm` (229) or `CreateTemplateForm` beyond the catalog hook; none has two responsibilities today.
- Merging the workout and template exercise rows.
- Server code, API routes and the 4.1 hooks other than adding `useExerciseCatalog`.
- AGENTS.md's broader rewrite (step 5.1); only the lines that name component locations change in the handbook sync.

[[Plans Index]]
