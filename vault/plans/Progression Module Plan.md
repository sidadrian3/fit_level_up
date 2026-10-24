# Progression Module Plan

> **For agentic workers:** each task below is one commit. Run `npx eslint <changed files> && npm run typecheck && npm run test:run` before handing a task back; the coordinator reviews and commits. Steps use checkbox (`- [ ]`) syntax for tracking.

**Step:** 3.1 in [[Architecture Overhaul Audit]] (§3.2 #1 #4 #6, F-15). **Spec:** [[Architecture Overhaul Design Spec]] D4, D5, D7, C4, C6. **Baseline:** 302 tests in 45 files, all green.

## Problem Statement

Game state (XP, level, streak, stamina, totals) lives on better-auth's `user` document, so every XP write is a write to a row the auth library owns, and the domain depends on fields the auth library doesn't know about. XP is applied by two code paths: `UserStateService.applyActivity` for workouts and runs, and `grantUserXP` for quest claims. Each has its own `__v` optimistic-lock retry loop stacked on top of a Mongo transaction, and its own level-up emit. `xpToNextLevel` is stored even though it is always `level × 500`. There is no record of why a user has their XP, so step 3.5 cannot reverse an edited or deleted activity exactly.

## Solution

A `src/server/progression/` module owns all game state, stored in a new `player_profiles` collection whose `_id` is the better-auth user id. The profile caches `totalXp`, and level, in-level XP and `xpToNextLevel` are computed from it. Every XP grant goes through one private path that writes an `xp_ledger` row, `$inc`s `totalXp` and emits `progression.leveled-up` through the outbox when the level changes. The caller's transaction is the only concurrency control: `__v` and both retry loops are deleted. A build-time migration copies existing game state into profiles without touching the `user` document (expand-only until step 5.1). `timeZone` stays on the `user` document as an account setting.

Callers keep their current shapes: a thin legacy `getUser` joins the auth identity (from `platform/auth`) with the player state (from progression) into today's `User`, so `/api/user`, the pages and the friends services don't change.

## Commits

### Task 1: Characterization tests (no production code)

Pin the behaviour this refactor must preserve where no test pins it today. Every test here passes on the current code.

- [ ] **`GET /api/user` route test** (new, next to the route, same mocking as `workouts/__tests__/route.test.ts`). Seed a user document with `level: 3, xp: 200, xpToNextLevel: 1500, streak: 4, stamina: 40, totalWorkouts: 12, totalDistance: 7.5, timeZone: "Asia/Manila"`, `lastActivityDate` and `lastStaminaUpdate` set relative to a faked `now`. Assert, with `vi.useFakeTimers`:
  - the exact key set: `id, email, name, avatar, level, xp, xpToNextLevel, streak, totalWorkouts, totalDistance, joinDate, lastActivityDate, stamina, lastStaminaUpdate, timeZone` plus `__v`. The `__v` key is removed in Task 7, and that is the only allowed change;
  - `lastActivityDate` is `"YYYY-MM-DD"`, `lastStaminaUpdate` is an ISO string, `joinDate` is `"YYYY-MM-DD"`;
  - display streak: `lastActivityDate` yesterday (Manila) → `streak: 4`; two days ago → `streak: 0`;
  - stamina recovery: last update two UTC days ago → `stamina: min(100, 40 + 2 × dailyRecovery)`;
  - a user document with no game fields → the defaults (`level 1, xp 0, xpToNextLevel 500, streak 0, stamina 100, totals 0`).
- [ ] **Quest claim grants XP** (add to `quests/__tests__/claim.test.ts`). A completed, unclaimed quest with `xpReward: 100` for a user at `level 1, xp 450` → 200, then the user reads back `level 2, xp 50`, and a second claim → 409.
- [ ] **Concurrent logging** (add to `log-workout.test.ts`). Two `logWorkout` calls with different idempotency keys run with `Promise.all` → `totalWorkouts` +2, XP equal to the sum of both `xpEarned`, and stamina reduced by both costs.

Commit: `test(progression): characterize user read, quest claim XP and concurrent logging`.

### Task 2: Pure progression rules

- [ ] Create `src/server/progression/progression.rules.ts` holding:
  - `levelFromTotalXp(totalXp)` → `{ level, xp, xpToNextLevel }`, using `GAME_CONFIG.leveling.xpPerLevelMultiplier`;
  - `calcLifetimeXp(level, xp)`, moved and used only by the backfill;
  - `calcNewStreak` and `calcDisplayStreak`, moved verbatim;
  - `calcRecoveredStamina`, moved verbatim.
- [ ] Unit tests in `src/server/progression/__tests__/progression.rules.test.ts`:
  - the existing `calcLevelUp` cases restated as totals (`450 + 50` → level 1, 500; `450 + 100` → level 2, 50; `450 + 2000` → the same level and remainder as today's test);
  - the existing streak, stamina and `calcLifetimeXp` cases, moved;
  - a round trip: `levelFromTotalXp(calcLifetimeXp(L, x))` returns `L, x` for `L` in 1..20 and `x` in `{0, L × 500 − 1}`;
  - `levelFromTotalXp(0)` → level 1, 0, 500.
- [ ] `lib/domain/user-rules.ts` and `stamina-rules.ts` keep only what other callers still need until later tasks. `calcLevelUp` stays until Task 6. `calcActiveDays`, `calcStaminaCost` and `calcExhaustionDebuff` stay for step 3.4. The moved functions are re-imported from progression where the old code still calls them; the G3 strangler exemption allows `lib → server`. Delete their old tests once the moved copies exist.

Commit: `refactor(progression): pure level, streak and stamina rules`.

### Task 3: Schema for `player_profiles` and `xp_ledger`

- [ ] `schema.ts`: add `playerProfiles: "player_profiles"` and `xpLedger: "xp_ledger"` to `COLLECTIONS`, the `PlayerProfileDoc` and `XpLedgerDoc` types (spec C6, verbatim), and `SCHEMA` entries:
  - `player_profiles`: validator requires `_id (string), totalXp, streak, stamina (number), lastActivityDay (string or null), lastStaminaUpdate, createdAt, updatedAt (date), totalWorkouts, totalDistance (number)`. No extra indexes; the `_id` lookup is the only query shape.
  - `xp_ledger`: validator requires `userId, sourceType (enum workout | run | quest_claim), sourceId (string), amount (number, minimum 0), occurredAt, createdAt (date)`. Unique index `idx_xpLedger_source` `{ userId: 1, sourceType: 1, sourceId: 1 }`.
- [ ] Export the new types from `platform/database/index.ts`.
- [ ] The existing `apply-schema` test covers creation and idempotence, so no new test.

Commit: `refactor(database): player_profiles and xp_ledger collections`.

### Task 4: Account accessors in `platform/auth`

- [ ] Add `getUserTimeZone(userId, { session? })` → `string` ("UTC" when unset or the user is missing), spec D7, and `getAccount(userId, { session? })` → `Account | null`, where `Account = { id, email, name, avatar, joinDate, timeZone }`. The mapping (avatar fallback `image` → `"zap"`, `joinDate` from `createdAt`) moves from `toUser`. Both live in a new `platform/auth/account.ts` and are exported from the entry.
- [ ] Switch `get-user-quests.ts` and `claim-quest-reward.ts` from `getUserTimeZoneFromDb` to `getUserTimeZone`. Delete `getUserTimeZoneFromDb`.
- [ ] `user-time-zone.test.ts` switches to `getUserTimeZone`/`getAccount`; same expectations.

Commit: `refactor(auth): getAccount and getUserTimeZone accessors`.

### Task 5: The progression module

- [ ] `profile.repository.ts`, the C3 named exception (`_id` is the user id; every function takes `userId`):
  - `findProfile(userId, { session? })`;
  - `applyActivityToProfile(userId, { streak, lastActivityDay, stamina, lastStaminaUpdate, totals }, session)`: `$set` streak, `lastActivityDay`, stamina, `lastStaminaUpdate` and `updatedAt`; `$inc` totals;
  - `incrementTotalXp(userId, amount, session)` → the document after the update.
  - Both writes are `findOneAndUpdate` with `upsert: true` and `$setOnInsert` defaults for every field **not** in that update's `$set`/`$inc` (Mongo rejects the same path in both).
  - Defaults: `totalXp 0, streak 0, lastActivityDay null, stamina 100, lastStaminaUpdate now, totals 0, createdAt now`.
- [ ] `xp-ledger.repository.ts`: `userScopedRepository<XpLedgerDoc>("xpLedger")`, with one named `recordXp(userId, { source, amount, occurredAt }, session)`.
- [ ] A private XP path (`add-xp.ts`, not exported from `index.ts`), shared by both use cases:
  1. insert the ledger row;
  2. `incrementTotalXp`;
  3. `previousLevel = levelFromTotalXp(after − amount).level`, `newLevel = levelFromTotalXp(after).level`;
  4. if they differ, `emit("progression.leveled-up", { userId, previousLevel, newLevel }, { session })`.
- [ ] `get-player-state.ts`: `getPlayerState(userId, { now?, session? })` → `PlayerState = { level, xp, xpToNextLevel, totalXp, streak, stamina, totalWorkouts, totalDistance, lastActivityDay?, lastStaminaUpdate: Date }`. The display streak uses `calcDisplayStreak` with `getUserTimeZone`, and stamina uses `calcRecoveredStamina`, both at `now`. A missing profile returns the defaults; nothing is written on read.
- [ ] `record-activity.ts`: `recordActivity({ userId, source, xp, staminaCost, totals, occurredAt }, session)` → `{ player: PlayerState; leveledUp }`.
  - Read the profile and the time zone in the session.
  - `streak = calcNewStreak(profile.streak, profile.lastActivityDay, occurredAt, tz)`, `lastActivityDay = toLocalDay(occurredAt, tz)`, `stamina = max(0, calcRecoveredStamina(stored, lastStaminaUpdate, now) − staminaCost)`, `lastStaminaUpdate = now`. These are exactly today's `applyActivity` computations.
  - `applyActivityToProfile`, then the XP path.
- [ ] `grant-xp.ts`: `grantXp({ userId, source, amount, occurredAt }, session)` → `{ player; leveledUp }`, which is the XP path only.
- [ ] `index.ts` exports `getPlayerState`, `recordActivity`, `grantXp`, `calcLifetimeXp` (for the backfill) and the types `PlayerState` and `XpSource`. `session` is a required parameter on both writes.
- [ ] `src/testing/players.ts` (a test-only helper): `seedPlayer({ name?, email?, timeZone?, createdAt?, profile?: Partial<PlayerProfileDoc> })` inserts an auth `user` (identity and `timeZone` only), plus a profile when `profile` is given, and returns the `userId`. `deletePlayer(userId)` removes both, plus the user's ledger rows.
- [ ] Integration tests in `src/server/progression/__tests__/` (move `grant-user-xp.test.ts`'s cases into `grant-xp.test.ts`):
  - **grantXp:** `level 1, xp 450` (`totalXp 450`) + 100 → level 2, 50, one ledger row `{ quest_claim, id, 100 }`, one outbox row `{ previousLevel 1, newLevel 2 }`; + 10 → no event; an aborted transaction leaves no ledger row, no XP and no event; a duplicate source rejects; +2000 → one event with the right `newLevel`.
  - **recordActivity:** first touch with no profile → a default profile with the activity applied; streak +1 when the last day was yesterday in Manila, unchanged on the same day, reset after a gap; stamina recovery then cost, floored at 0; totals `$inc`; a ledger row per call.
  - **Concurrency:** two `grantXp` on one profile in parallel transactions → both ledger rows exist and `totalXp` is the sum.
  - **getPlayerState:** defaults for a missing profile; display streak 0 after a gap; recovered stamina.

Commit: `refactor(progression): player profiles, xp ledger and the one XP path`.

### Task 6: Writers move to progression

- [ ] `log-workout.ts` and `log-run.ts`:
  - read stamina for evaluation through `getPlayerState(userId, { now, session })` and the time zone for quest progress through `getUserTimeZone(userId, { session })`;
  - call `recordActivity` after the insert with `source: { type: "workout" | "run", id }`, `xp: xpEarned`, `staminaCost`, `totals: { workouts: 1 }` or `{ distanceKm }`, and `occurredAt: now`.
- [ ] `claim-quest-reward.ts` calls `grantXp` with `source: { type: "quest_claim", id: quest._id.toString() }`, `amount: template.xpReward` and `occurredAt: now`. The route still returns `{ success: true }`.
- [ ] Delete `grant-user-xp.ts`, `UserStateService.applyActivity`, `updateUserXPInDb`, `applyUserActivityInDb`, the unused `updateUserStatsInDb` and `updateUserStaminaInDb`, and `calcLevelUp`.
- [ ] Tests that exercise these writers switch their setup to `seedPlayer` and their read-back to `getPlayerState` or the profile document. Affected: `log-workout`, `log-run`, `update-quest-progress`, the workouts/runs route tests, the claim test and the Task 1 tests. `lastActivityDate` assertions become `lastActivityDay: "2026-10-21"`. **No expected value changes.**
- [ ] For as long as Task 7 is pending, `UserStateService.getUser` still reads the `user` document, so readers would see stale state. Tasks 6 and 7 therefore ship as **one commit**, and the coordinator runs them back to back.

### Task 7: Readers move to the composed `getUser` (same commit as Task 6)

- [ ] `lib/services/users/get-user.ts`: `getUser(userId, { session? })` joins `getAccount` (throws `NotFoundError` when null) and `getPlayerState` into today's `User`: `lastActivityDate = lastActivityDay`, `lastStaminaUpdate` as an ISO string, and no `__v`.
- [ ] Switch every `UserStateService.getUser` caller: `/api/user`, `/api/stats/dashboard`, the dashboard and profile pages, `evaluate-achievements`, `get-friends`, `get-friend-requests`, `send-friend-request`, `accept-friend-request` and `notify-friends-level-up`.
- [ ] `getDashboardStats` takes `{ timeZone, totalXp }` instead of `User`, and `lifetimeXP = totalXp`. Its callers pass `getPlayerState`'s `totalXp`, or a `User` widened by the composer. Pick the smaller diff and keep the response shape.
- [ ] Delete `user-state.service.ts` and `user-db.ts` (`toUser` and `getUserFromDb`; `getAccount` replaced them). Remove `__v` from `User`, and remove the game fields from the `UserDoc` type. The data stays until 5.1; the type no longer advertises it.
- [ ] Remaining tests that seed game fields on `user` (`friends`, `evaluate-achievements`, `outbox-sweep`, `get-dashboard-stats`, `user-time-zone`) switch to `seedPlayer`. The Task 1 `/api/user` test drops `__v` from its key set; that is its only change.

Commit (Tasks 6 + 7): `refactor(progression): activity, quest claim and user reads go through progression`.

### Task 8: Backfill migration `003-backfill-player-profiles`

- [ ] `up(db)` streams `user` documents that have a `level` field (projection: the game fields only) and `bulkWrite`s upserts into `player_profiles` in batches of 500. Each entry is `filter { _id: user._id.toString() }` and `$setOnInsert`:
  - `totalXp = calcLifetimeXp(level, xp)`;
  - `streak`;
  - `lastActivityDay = lastActivityDate?.toISOString().slice(0, 10) ?? null` (the Date already holds the user's local day at UTC midnight);
  - `stamina ?? 100`, `lastStaminaUpdate ?? createdAt`, `totalWorkouts ?? 0`, `totalDistance ?? 0`;
  - `createdAt` and `updatedAt` set to now.
- [ ] It never writes to `user` (expand-only, D5). Register it in `MIGRATIONS` after `002`.
- [ ] Tests in `scripts/migrations/__tests__/`:
  - a user with game fields → the expected profile;
  - a user without game fields → no profile;
  - an existing profile is not overwritten;
  - a rerun is a no-op;
  - the `user` document is unchanged byte for byte.

Commit: `refactor(progression): backfill player_profiles from user documents`.

### Task 9: Boundary check

- [ ] `grep` for `level|xp|xpToNextLevel|streak|stamina|lastStaminaUpdate|lastActivityDate|lastActivityDay|totalWorkouts|totalDistance|totalXp` reads or writes on the `user` or `player_profiles` collections outside `src/server/progression/` and migration 003. Nothing outside progression may touch the profile collection.
- [ ] `npx depcruise src` is clean, with no new known violations.
- [ ] Confirm the full suite is green, with the test count at or above the baseline.

No commit unless the check finds something to fix.

## Decision Document

- **Module.** `progression` is a new server module whose public API is `getPlayerState`, `recordActivity`, `grantXp`, `calcLifetimeXp` and the `PlayerState`/`XpSource` types. It imports only platform (database, events, auth for the time zone, config) and `src/shared/time`. It calls no other feature module.
- **Reads.** Progression reads only `player_profiles`. Auth identity comes from `platform/auth` (`getAccount`, `getUserTimeZone`). The legacy `getUser` in `lib/services/users` joins them into `User` for existing callers; steps 3.3–3.7 replace each caller with the narrower call it needs (training: stamina; achievements: level, streak and totals).
- **Writes.** `recordActivity` and `grantXp` require the caller's `ClientSession`. Streak and stamina are read inside the transaction, computed with the pure rules and written with `$set`, while XP and totals use `$inc`. A concurrent transaction on the same profile gets a WriteConflict, and `withTransaction` reruns the whole callback, so no update is lost. `__v` is removed everywhere.
- **One XP path.** The ledger insert, the `totalXp` `$inc`, the level comparison and the `progression.leveled-up` emit live in one private function used by both writes (fixes F-15).
- **Ledger.** One row per source (`workout`/`run` → the activity `_id`; `quest_claim` → the `user_quests` row `_id`), unique on `(userId, sourceType, sourceId)`. A duplicate aborts the transaction; idempotency keys already turn client retries into replays first. There is no ledger backfill here (step 3.5 does that).
- **Derived values.** `level`, in-level `xp` and `xpToNextLevel` are computed by `levelFromTotalXp`, never stored.
- **Profiles.** `_id` is the better-auth user id string. A profile is created lazily by the first write (`$setOnInsert`), and reads fall back to defaults without writing.
- **Time zone.** `timeZone` stays on the auth `user` document (D7). `lastActivityDay` is a `"YYYY-MM-DD"` string in the user's zone.
- **Migration.** 003 is expand-only: the game fields stay on `user` until the 5.1 cleanup migration. The deploy-window gap (an activity logged on the old deploy between the build-time backfill and cutover) and inconsistent old rows are accepted; step 3.5's ledger backfill rebuilds XP from the activities.
- **Wire shapes.** `/api/user` keeps its shape except for the removal of `__v`, which no client reads. Quest claim keeps `{ success: true }`. Dashboard stats keep `lifetimeXP`.

## Testing Decisions

- Tests assert outcomes (stored profile, ledger rows, outbox rows, API JSON), never call order or internal helpers.
- Characterization comes first (Task 1), so the move is checked against tests that ran green on the old code. Later tasks may change test **setup and read-back only**; a changed `expect` value in a diff is a red flag for review.
- Integration tests run against the in-memory replica set with `applySchema()` validators, with prior art in `log-workout.test.ts`, `grant-user-xp.test.ts` and the outbox tests. Unit tests cover only `progression.rules.ts` (prior art: `user-rules.test.ts`).
- Every test that touches `outbox` clears it first, and tests clean up their users, profiles and ledger rows through `deletePlayer`.
- Clock: `vi.useFakeTimers` with `toFake: ["Date"]` where a test pins streak or recovery days.

## Out of Scope

- Edit and delete reconciliation, the ledger backfill and `replaceSourceXp`/`revokeSource` (step 3.5).
- Moving quests (3.3) or training (3.4) into modules, and moving `calcStaminaCost`, `calcExhaustionDebuff` and `calcActiveDays`.
- The friends N+1 (`getFriends` loads every friend's state one by one), which goes to step 3.7.
- Unsetting the old game fields on `user` (step 5.1).
- Front-end components and query keys; they keep reading `User`.
- Moving `timeZone` off the `user` document.

## Further Notes

- Riskiest part: the `calcLifetimeXp` ↔ `levelFromTotalXp` round trip, which the rules test pins and the `/api/user` characterization test checks end to end.
- `getPlayerState` reads the time zone separately from `getAccount`, so `getUser` makes one extra `_id` lookup. That's accepted to keep progression free of identity fields; the batch read for friends belongs to 3.7.
- Production uses `user` documents created before step 0.7, whose `timeZone` may be unset; `getUserTimeZone` returns "UTC", matching today.

[[Plans Index]]
