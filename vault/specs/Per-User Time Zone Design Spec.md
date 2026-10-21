# Per-User Time Zone Design Spec

**Status:** Draft, 2026-10-21. Closes audit finding F-8 (step 0.7 in [[Architecture Overhaul Audit]]). Design critique (Step 3.5) ran: no visual surface, see §8.

## Problem Statement

Every calendar-day calculation runs in UTC. `toISOString().slice(0, 10)` decides "today" for streaks and quest periods, and `getMondayDateString` mixes the server's local `getDay()` with UTC formatting. For a user in Manila (UTC+8), a 7 AM workout lands on *yesterday*: it can break a streak, count toward the wrong daily quest and fall outside "this week" on the dashboard. Domain rules also read the clock themselves (`calcDisplayStreak`, `calcActiveDays`, `getPeriodForCategory` through `utils/dates`), which F-17 flags.

## Solution

Store a validated IANA `timeZone` per user, captured from the browser. Every calendar-day calculation receives `now` and `timeZone` as arguments and works in the user's local calendar. Stored data keeps its shape, so no backfill is needed.

## User Stories

1. As a user east of UTC, I want a morning workout to count for today, so that my streak doesn't break.
2. As a user west of UTC, I want a late-evening workout to count for today, not tomorrow.
3. As a user, I want daily quests to reset at my midnight and weekly quests at my Monday midnight.
4. As a user, I want "this week", "last week" and the activity dots on the dashboard to follow my week.
5. As an existing user, I want my time zone picked up automatically, without logging out and in again.

## Goals, Non-Goals, Anti-Goals

- **Goals:** a local calendar for streaks (`calcNewStreak`, `calcDisplayStreak`), quest periods (`getPeriodForCategory` and every caller), dashboard week boundaries, active days, and the "current quests" filter. Domain rules never read the clock.
- **Non-goals:**
  - a settings control to change the time zone (it is captured only when missing);
  - activity-card dates (`toWorkout`/`toRun` still return the UTC day, see Out of Scope);
  - `calcMuscleVolume` taking `now` (step 3.4 does it);
  - moving game state to `player_profiles` (step 3.1).
- **Anti-goals:**
  - A signup that fails because the browser reported an odd zone.
  - Any migration or backfill of existing documents.
  - A domain rule that calls `new Date()`.

## Implementation Decisions

### 1. Storage: better-auth `additionalFields`

`timeZone` is declared in `src/lib/auth/server.ts`:

```ts
user: {
  additionalFields: {
    timeZone: { type: "string", required: false, input: true, validator: { input: timeZoneSchema } },
  },
},
```

- **No `defaultValue`.** A missing field means "not captured yet", and the client uses that to backfill it. The read side (`toUser`) falls back to `"UTC"`.
- **`input: true`** lets `signUp.email` and `updateUser` carry the value. better-auth runs `validator.input` (Standard Schema, which Zod 4 satisfies) on both, so no new API route is needed.
- The client adds the `inferAdditionalFields<typeof auth>()` plugin to `authClient`, so `session.user.timeZone` is typed.
- **Why not `player_profiles` now:** creating the collection before step 3.1 would put user state in two places for the whole migration.
- **At step 3.1:** a time zone is an account setting, not something earned by playing. The recommendation is that it stays on the better-auth `user` document and audit §6 ("`timeZone` on the player profile") is amended. If 3.1 moves it instead, its backfill copies the field, the `additionalFields` entry is removed, and the two client writers switch to a profile write. 3.1 makes this call.

### 2. Validation

`timeZoneSchema` lives in `src/lib/validations/schemas.ts`:

```ts
z.string().min(1).max(64).refine(isValidTimeZone, "Invalid time zone")
```

`isValidTimeZone` (in `src/lib/utils/dates.ts`) accepts a value when both hold:

- `new Intl.DateTimeFormat("en-US", { timeZone })` does not throw;
- the value is not a fixed offset (`/^[+-]/`, e.g. `+08:00`, which Node accepts but which is not an IANA zone).

The schema must stay synchronous: better-auth's `parseUserInput` (used by both `sign-up` and `update-user`) rejects an async Standard Schema with `ASYNC_VALIDATION_NOT_SUPPORTED`.

It deliberately does **not** check membership in `Intl.supportedValuesOf("timeZone")`. That list omits `"UTC"` and legacy aliases such as `Asia/Calcutta`, which browsers still report.

### 3. Capture

- A client helper `getBrowserTimeZone(): string | undefined` returns `Intl.DateTimeFormat().resolvedOptions().timeZone` if it passes `isValidTimeZone`, else `undefined`. Callers omit the field when it returns `undefined`, so a strange browser value never fails a request.
- **Signup** (`src/app/(auth)/signup/page.tsx`) passes `timeZone` to `authClient.signUp.email`.
- **Existing users:** a `TimeZoneSync` client component in `src/app/(app)/layout.tsx` (beside `LevelUpManager` and the other managers) reads `authClient.useSession()`. When `session.user.timeZone` is missing and `getBrowserTimeZone()` returns a value, it calls `authClient.updateUser({ timeZone })` once per mount and renders nothing. This replaces a login-page check, because better-auth sessions renew themselves for 7 days while the user is active, so active users never see the login page again. Fresh logins land on `/dashboard` and are covered too.
- A saved time zone is never overwritten automatically, even if the browser later reports a different one (travel, a move). Changing it is the settings control listed as a non-goal.
- After the update, the client invalidates nothing. Server pages read `timeZone` on their next request, and the rest of the client never reads it.

### 4. Calendar helpers (`src/lib/utils/dates.ts`, rewritten)

All functions are pure. None reads the clock. Day strings are `YYYY-MM-DD`.

| Function | Purpose |
|---|---|
| `isValidTimeZone(tz)` | §2 |
| `toLocalDay(instant, timeZone)` | `Intl.DateTimeFormat("en-CA", { timeZone })`, formatters cached per zone in a `Map` (the apartment-system `property-date.ts` idea, made per user) |
| `addDays(day, n)` | Calendar arithmetic on day strings through `Date.UTC`. Never DST-affected |
| `startOfWeek(day)` | The Monday of that day's week. Day-of-week is read from the day string, never from the server's local time |
| `startOfLocalDay(day, timeZone)` | The first instant of that local day, as a `Date`. Handles DST: in a zone where midnight is skipped (e.g. `America/Santiago`), it returns the first instant that exists on that day. Verified by checking that `toLocalDay(result, tz) === day` |

`getTodayDateString`, `getMondayDateString`, `getSundayDateString` and `getLastWeekBoundaries` are removed; every caller moves to the helpers above.

### 5. Domain rules

The signatures follow the request: each calendar-day rule takes `now` and `timeZone`.

- `calcNewStreak(currentStreak, lastActivityDay: string | undefined, now: Date, timeZone: string)`: today is `toLocalDay(now, timeZone)`. The comparison logic is unchanged (same day, consecutive day, or gap). The `Date` branch for `lastActivityDay` goes away, because `User.lastActivityDate` is already a day string.
- `calcDisplayStreak(rawStreak, lastActivityDay, now, timeZone)`: today and yesterday come from `toLocalDay` and `addDays(today, -1)`. The `new Date()` default is removed.
- `calcActiveDays(activityInstants: Date[], now, timeZone)`: maps each instant to its local day and marks Monday–Sunday of `startOfWeek(toLocalDay(now, timeZone))`.
- `getPeriodForCategory(category, now, timeZone)`: daily is `[today, today]`, weekly is `[startOfWeek(today), addDays(startOfWeek(today), 6)]`, and all-time is unchanged.

### 6. `lastActivityDate` encoding: unchanged shape, local meaning

`user.lastActivityDate` stays a BSON `Date` at UTC midnight. From now on it holds the user's **local** day, written as `new Date(`${localDay}T00:00:00Z`)`. `toUser` keeps mapping it with `toISOString().slice(0, 10)`, which returns the local day. Existing documents need no migration: they already hold a day in this encoding (the UTC day).

**Known transition effect (accepted):** the first comparison after a user's zone is captured mixes their last UTC day with a local today.

- East of UTC, nothing breaks that the old rule didn't already break.
- West of UTC, a late-evening activity stored as the next UTC day can make the next local-day activity read as "same day", losing one streak increment once.

There is no grace rule.

### 7. Services and data

- **`UserStateService`**
  - `getUser` passes `new Date()` and `rawUser.timeZone` to `calcDisplayStreak`.
  - `applyActivity` takes `activityAt: Date` instead of `activityDate`. It computes `activityDay = toLocalDay(activityAt, user.timeZone)`, calls `calcNewStreak(user.streak, user.lastActivityDate, activityAt, user.timeZone)`, and stores `lastActivityDate` per §6.
- **`logWorkout` / `logRun`:** take `const now = new Date()` once. It is used for the inserted `date` and for `applyActivity`. Both pass `{ now, timeZone: user.timeZone }` into `updateQuestProgress`. Today both rebuild the activity date from the UTC day string returned by `toWorkout`/`toRun`; this change removes that.
- **Quests:**
  - `ensureUserQuestRows`, `syncUserQuests` and `updateQuestProgress` take the `now` and `timeZone` pair. `updateQuestProgress`'s own `getPeriodForCategory` call (line 32) uses it too.
  - `getUserQuestsForUserFromDb(userId, today, session?)` takes `today` from the caller instead of building a UTC one.
  - The entry points without a user loaded (`getUserQuests` and `claimQuestReward`) read the time zone through a new projection read `getUserTimeZoneFromDb(userId)` in `user-db.ts` (by `_id`, returns `"UTC"` when absent).
- **Dashboard:**
  - `getDashboardStats(userId, user)` computes `today = toLocalDay(new Date(), user.timeZone)` and `weekStart = startOfWeek(today)`, plus the instants `thisWeekFrom = startOfLocalDay(weekStart)`, `lastWeekFrom = startOfLocalDay(addDays(weekStart, -7))` and `nextWeekFrom = startOfLocalDay(addDays(weekStart, 7))`.
  - `countWorkoutsInRange` and `getTotalDistanceInRange` change to `(userId, from: Date, toExclusive: Date)` with `$gte`/`$lt`. This also fixes a latent bug: "last week" currently ends at Sunday 00:00 with `$lte` and drops Sunday's workouts.
- **Dashboard page:** instead of passing every workout's UTC day string to `calcActiveDays`, it gets this week's instants from a new `getWorkoutDatesInRange(userId, from, toExclusive): Promise<Date[]>` (projection `{ date: 1 }`, served by the existing `idx_workouts_userId_date`).
- **`User` type** (`src/lib/types.ts`) gains `timeZone: string`, and `UserMongoDoc` gains `timeZone?: string`.
- **Achievements sweep:** `sweepLockedAchievements` looks back 72 hours instead of 24. Under §6 encoding a local day's midnight can sit up to 36 h before the activity instant (UTC−12), and the 24 h window already missed some UTC users. `evaluateAchievements` is idempotent, so the wider window only costs more users per sweep.
- **Dead code removed:** `updateUserStreakOnActivity` and `updateUserStreakInDb` in `user-db.ts` have no callers and would otherwise need the new `calcNewStreak` signature.

### 8. Route contract

There is no new API route. The only contract change is better-auth's existing endpoints:

| Endpoint | Change |
|---|---|
| `POST /api/auth/sign-up/email` | Optional `timeZone: string`, validated by `timeZoneSchema`. An invalid value gives better-auth's 400 |
| `POST /api/auth/update-user` | Same optional field, same validator |
| `GET /api/auth/get-session` | `user.timeZone?: string` in the response |

Responses that return `User` (`UserStateService.getUser` consumers) gain `timeZone: string`.

Design critique (Step 3.5): the only UI pieces are an invisible `TimeZoneSync` component and one extra field in an existing signup call. Neither renders anything, so the design-quality skills have nothing to judge.

## Testing Decisions

- **Domain unit tests** (`src/lib/domain/__tests__/user-rules.test.ts`, a new `quest-rules.test.ts`, and `dates` helper tests next to the existing ones):
  - Manila 07:00 local = 23:00Z the previous day: the streak counts for the local day.
  - New York 23:00 local = 04:00Z the next day: same.
  - Display streak at the local day boundary.
  - Daily and weekly periods on a Sunday-night/Monday-morning boundary in UTC+8 and UTC−5.
  - `startOfLocalDay` across a DST change (`America/New_York` in March and November) and a skipped midnight (`America/Santiago`, September).
  - `isValidTimeZone` accepts `UTC` and `Asia/Calcutta`, and rejects `+08:00`, `""` and `Mars/Base`.
- **Integration (in-memory replica set):**
  - `log-workout.test.ts`: a user in `Asia/Manila` logging at 23:30Z keeps a streak whose `lastActivityDate` was the previous local day, and the stored `lastActivityDate` is the local day.
  - `update-quest-progress.test.ts`: progress lands on the local-period row.
  - The dashboard-stats service: last week's Sunday workout is counted.
  - `sweep-locked-achievements.test.ts`: the 72 h window.
  - The clock is controlled with `vi.setSystemTime` only where a service reads it.
- **Signup validator:** one integration test through `auth.api.signUpEmail` that rejects an invalid `timeZone` and stores a valid one.

## Out of Scope

- **Activity-card dates.** `toWorkout`/`toRun` return the UTC day string and `formatDate` renders it in the browser zone, so cards can show the wrong day in both directions. This is a follow-up for step 3.4 (the `training` module).
- A settings control for the time zone.
- `calcMuscleVolume` reading the clock (step 3.4).

[[Specs Index]]
