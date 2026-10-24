# Edit And Delete Reconciliation

**Type:** feature-api
**Areas:** workouts, runs, quests, stats, profile, database
**Surfaces:** api-only
**Pipeline outcome:** agentic
**Lane:** full

## Readiness at start

Assumptions: pre-3.1 quest claims use the `user_quests` row's creation time as `occurredAt` (claim time was never stored); migration 005 runs at build before cutover, so `highestLevel` can be a required field at once; the route handlers, request schemas and response shapes stay unchanged.
Riskiest part: the quest clawback runs inside the delete transaction and calls `revokeSource` a second time, so two re-sums, a quest write and a possible level drop all have to agree; recounting before the activity is deleted would silently keep the reward.

## What was built

Editing or deleting a workout or run now reverses what it earned. `replaceSourceXp` and `revokeSource` replace or remove the activity's `xp_ledger` row and set `totalXp` to the ledger sum, so the level can fall. Totals change by the exact delta, quest progress is recounted for the activity's own period with a clawback of claimed rewards that no longer hold, a delete recounts the streak, and `activity.reverted` is emitted. A `highestLevel` high-water mark means a level lost and re-earned announces nothing. Migration 005 backfills the ledger and resets profile XP and totals.

## Decisions made

- Level-down is allowed: level is a pure function of `totalXp` and a level-up grants nothing stateful here, unlike Habitica, which keeps the level because its level-up refills HP and grants stat points ([[Reward Reversal Research]]).
- Claimed quest rewards are clawed back even for past periods: the rule "claimed implies progress at or above the target" holds regardless of date, and friends are ranked by XP so a kept reward affects other people.
- Unlocked achievements are kept and `activity.reverted` has no listener: achievements carry no XP, and fitness products keep badges after the data behind them is deleted.
- `highestLevel` gates both `leveledUp` in responses and the `progression.leveled-up` event: one meaning of "levelled up", so delete-and-relog loops never repeat a celebration or a friend notice.
- Streak is recounted on delete only, over the whole streak window: edits never change an activity's date, and a hole in the middle breaks "consecutive days" the same as one at the end.
- Stamina is untouched by edit and delete, and edits keep ignoring the exhaustion penalty: stamina may be removed, and persisting an "exhausted" flag would couple every activity document and the backfill to it.
- Progression and quests read activity data through callbacks training passes (`ActivityDays`, `QuestMeasure`): training already imports both modules, so the reverse import would be a cycle.
- Server-only: the confirm dialog previewing the cost is Phase 4; the only client change is that both delete mutations also invalidate `["user"]`.
- Replace or delete the ledger row rather than adding compensating entries: it keeps the one-row-per-source key and makes every reversal idempotent by key.

## Verification

Escalations: one plan-wrong at Task 1 (migration 003 inserted profiles without `highestLevel` once the validator required it; fixed in place and the plan revised). One deviation accepted at Task 4 (the backfill's `highestLevel` max includes the stored value so a rerun cannot lower it; spec updated).
UI verified: n/a (API type; the client change is a cache invalidation line).
Handbook: Data Model And API Reference, Project Briefing, Domain Architecture

## Notes

- Tests: 389 before, 432 after. The only existing expectation changed on purpose is the two item-route tests that asserted a delete leaves XP and totals alone.
- Known gaps (in the spec): an edit ignores the exhaustion penalty, so a workout logged while exhausted earns full XP once edited; an edit that raises distance can satisfy a distance achievement that only unlocks on the next logged activity; quest periods use the current time zone; the backfill leaves quest progress and streaks as they are.
- Production deploy: migration 005 resets every profile's `totalXp` to the ledger sum, so test accounts that exploited F-4 lose that XP. Check the profiles you care about before the build runs.
- Git worktrees branch from `master`, not the feature branch; parallel agents must `git reset --hard feature/<branch>` first, or they build on old code. Leftover worktrees under `.claude/worktrees/` also get picked up by `npm run test:run` and fail it until removed.
- One unexplained single test failure appeared in one full run during Task 3 and did not reproduce in any later run.

[[History Index]]
