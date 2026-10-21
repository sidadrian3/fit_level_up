# Per-User Time Zone

**Type:** feature-fullstack
**Areas:** auth, quests, stats, workouts, runs, achievements, database
**Surfaces:** ui, cron
**Pipeline outcome:** agentic
**Lane:** full

## Readiness at start

Assumptions: existing users west of UTC may lose one streak increment once when their zone is first saved; a saved zone is never overwritten automatically; activity-card dates keep showing the UTC day until step 3.4
Riskiest part: finding local midnight across daylight-saving changes without a Temporal API

## What was built

Audit F-8 (step 0.7). `user.timeZone` is a validated IANA zone on the Better Auth user document, captured at signup and backfilled by a `TimeZoneSync` component in the app layout. Streaks, quest periods, the dashboard week and active days take `now` and `timeZone` as arguments, so domain rules no longer read the clock. Stored shapes are unchanged: `lastActivityDate` holds the user's local day as UTC midnight.

## Decisions made

- `timeZone` stays on the Better Auth user (`additionalFields`) rather than waiting for `player_profiles`: creating the collection before step 3.1 would split user state across two documents. Step 3.1 decides whether it is an account setting or game state.
- Backfill runs from the app layout, not the login page: Better Auth sessions renew for 7 days of activity, so active users never see login again.
- No grace rule for the first streak comparison after a zone is saved: one skipped increment at most, once, against a flag and a branch in `calcNewStreak`.
- Validation checks that `Intl` accepts the value and that it is not a fixed offset, instead of `Intl.supportedValuesOf`, which omits `UTC` and aliases such as `Asia/Calcutta`.
- Dashboard ranges are `[from, toExclusive)` instants; this also fixes "last week" dropping Sundays.
- The achievements sweep looks back 72 hours: a local-day midnight can sit up to 36 hours before the activity.
- `updateUserStreakOnActivity` and `updateUserStreakInDb` were deleted (no callers).

## Verification

Escalations: first dispatch of Tasks 4 and 6 failed (worktrees created from `master`, no code written); re-dispatched with a reset to the feature commit
UI verified: signup from a Manila browser stores `Asia/Manila`; unsetting it and reloading `/dashboard` restores it with one `update-user` call; `/dashboard`, `/quests`, `/workouts`, `/profile`, `/api/quests`, `/api/stats/dashboard` return 200; `+08:00` is rejected with 400. Run on port 3100 because ports 3000 and 3001 belong to apartment-system. One throwaway account was created in the Atlas dev database.
Handbook: Data Model And API Reference, Domain Architecture, Project Briefing, Architecture Overhaul Audit
Code review: Standards found no hard violations (extracted `weekInstants`, named the sweep constant); Spec found no gaps

## Notes

- The Playwright browser (`chromium_headless_shell`) was installed into the user cache for UI verification.
- `calcMuscleVolume` still reads the clock; step 3.4 takes it.
- Step 3.1 must decide where `timeZone` lives (see [[Architecture Overhaul Audit]] carry-over notes).
- Specs: [[Per-User Time Zone Design Spec]]; plan: [[Per-User Time Zone Plan]].

[[History Index]]
