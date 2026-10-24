# Edit And Delete Reconciliation Design Spec

**Status:** Approved, 2026-10-24, after a brainstorm, a research pass ([[Reward Reversal Research]]) and a grilling pass. Step 3.5 in [[Architecture Overhaul Audit]]: fixes F-4 and §3.2 #3, and implements the reversal half of D6b and C6 of [[Architecture Overhaul Design Spec]], with the amendments listed under Decisions. Type API (the only client change is a cache invalidation, no visual surface), so the design critique (Step 3.5) does not apply.

Read spec D6b and C6 first. This spec restates only what the build needs beyond them.

## Problem Statement

`updateWorkout` and `updateRun` recompute `xpEarned` on the activity but never touch the player's XP, level, totals or quest progress, and `deleteWorkout`/`deleteRun` only remove the row. A user can log a 300-minute workout, collect the XP and a level-up, then edit it to 1 minute or delete it and keep everything. Friends are sorted by these numbers, so the drift is visible to other people.

The ledger write path exists since step 3.1: every workout, run and quest claim since then has an `xp_ledger` row. What is missing is the reversal, and ledger rows for everything logged before 3.1.

## Solution

Edit and delete become transactional use cases in `src/server/training`. Inside one transaction they change the activity, then:

1. **XP.** `replaceSourceXp` (edit) or `revokeSource` (delete) replaces or removes the activity's ledger row and sets `totalXp` to the ledger sum. Level is computed from `totalXp`, so it follows in both directions, including down.
2. **Totals.** `totalWorkouts` and `totalDistance` change by the exact delta training passes (`-1` workout; `newDistance − oldDistance` or `−distance` km).
3. **Quests.** Progress for each quest the activity counts toward is recounted for the period containing the activity's own date. A claimed quest whose recounted progress falls below its target is clawed back: its `quest_claim` ledger row is revoked and the row returns to unclaimed and incomplete.
4. **Streak (delete only).** When the deleted activity was the only one on its local day and that day lies inside the current streak, the streak is recounted from the activity days that remain.
5. **Event (delete only).** `activity.reverted` is emitted.

A new `highestLevel` on the profile makes "levelled up" mean "reached a level never reached before", so a delete-and-relog loop never repeats a level-up. Migration 005 backfills the ledger from existing activities and claimed quests and resets each profile's XP and totals from the source data.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | **Level-down is allowed.** XP is reversed exactly and the level falls with it | Level is a pure function of `totalXp` and a level-up grants nothing stateful here, so nothing needs undoing beyond the number. Habitica keeps the level only because its level-up refills HP and grants stat points (research §1) |
| 2 | **Claimed quest rewards are clawed back** when the recounted progress for that period is below the target, **including past periods** | The invariant "claimed ⇒ completed ⇒ progress ≥ target" holds regardless of date. A past period can't be re-earned, so the reward is lost for good, which is the honest outcome; otherwise "delete old runs" keeps rewards free. Friends are ranked by XP, so cheating affects others (research §2) |
| 3 | **Unlocked achievements are kept**, and `activity.reverted` has no listener yet | Achievements carry no XP. Fitness products keep badges after the data behind them is deleted (research §3). The event is emitted so a later listener (feed, notifications) needs no change in training |
| 4 | **Streak is recounted on delete only**, over the whole streak window, not just its last day | Edits never change an activity's date, so they can't affect a streak. A hole in the middle breaks "consecutive days" the same as one at the end; Strava ends the streak whenever the only qualifying activity is deleted (research §4) |
| 5 | **`highestLevel` high-water mark.** `leveledUp` in responses and the `progression.leveled-up` event both fire only when the new level exceeds `highestLevel` | One meaning of "levelled up". A user who drops from 5 to 4 and re-earns 5 gets no toast and friends get no second notice. Achievement evaluation runs only on real progress |
| 6 | **No level-down notice** of any kind | The player sees the new level in the app. Broadcasting a loss is demotivating and nobody documents doing it (research §5) |
| 7 | **Stamina is untouched** by edit and delete: no refund on delete, and edits keep recomputing XP at full value without the exhaustion penalty | Stamina may be removed. Persisting an "exhausted" flag on every activity would couple the activity documents and the backfill to it. The cost is a known gap (below) |
| 8 | **Replace or delete the ledger row** (Fowler's replacement adjustment), not compensating entries | Keeps the one-row-per-source unique key and makes every reversal idempotent by key. A compensating-entry ledger is the documented refactor if an audit trail is ever needed (research §5) |
| 9 | **Amends C6:** `replaceSourceXp` also takes `occurredAt`, and upserts when the row is missing; `revokeSource` treats a missing row as nothing to remove; `revokeSource` takes optional `activityDays` | Activities logged in the 3.1 deploy window may lack a row until 005 runs. The quest clawback reuses `revokeSource` without a streak recount |
| 10 | **Progression and quests read activity data through callbacks** that training passes, never by importing training | Training already imports both modules; the reverse import would be a cycle (G1). The callbacks keep progression and quests ignorant of collections they don't own |
| 11 | **The backfill does not recount quest progress or streaks** | Claims already granted before this step count as ledger rows. Production holds mostly test accounts, and recounting every period of every user is a separate, larger migration |
| 12 | **Server-only.** The only client change is that the two delete mutations also invalidate `["user"]` (edits already do, through `useEntityForm`) | A confirm dialog that previews the cost is Phase 4 work |

## Contract

### Files

```
src/server/progression/
  replace-source-xp.ts          new: replaceSourceXp
  revoke-source.ts              new: revokeSource (+ streak recount)
  add-xp.ts                     high-water rule for leveledUp
  xp-ledger.repository.ts       + upsertXp, deleteXp, sumXp
  profile.repository.ts         + setTotalXp (with totals delta), setStreak, highestLevel default
  progression.rules.ts          + recountStreak (pure)
  index.ts                      exports the two new functions and the ActivityDays type
src/server/quests/
  recount-quest-progress.ts     new: recountQuestProgress
  quest.rules.ts                + periodRange (period → instant range, pure)
  quest.repository.ts           + findQuestRow, setQuestRecount
  index.ts                      export
src/server/training/
  workouts/update-workout.ts    transactional; replaceSourceXp
  workouts/delete-workout.ts    transactional; revokeSource, quest recount, activity.reverted
  runs/update-run.ts            transactional; replaceSourceXp with distance delta, quest recount
  runs/delete-run.ts            transactional; revokeSource, quest recount, activity.reverted
  workouts/workout.repository.ts, runs/run.repository.ts
                                session-aware find/delete returning the document; range counts and
                                raw distance sum; distinct local activity days
  activity-days.ts              new: the ActivityDays implementation over workouts and runs
  events.ts                     + activity.reverted
src/server/platform/database/schema.ts   PlayerProfileDoc.highestLevel + validator
src/scripts/migrations/005-backfill-xp-ledger.ts   new, registered in index.ts
src/app/(app)/workouts/page.tsx, src/app/(app)/runs/page.tsx   delete invalidates ["user"]
```

File names are a guide; the plan may merge them where a file would hold one short function.

### Progression API (amends C6)

```ts
type Totals = { workouts?: number; distanceKm?: number };

// Distinct local days ("YYYY-MM-DD", user's zone) that still have a workout or run.
export type ActivityDays = {
  since(fromDay: string): Promise<string[]>;   // days >= fromDay
  latest(): Promise<string | null>;            // most recent remaining day, or null
};

replaceSourceXp(
  input: { userId: string; source: XpSource; amount: number; occurredAt: Date; totals: Totals },
  session: ClientSession,
): Promise<{ player: PlayerState; leveledUp: boolean }>;

revokeSource(
  input: { userId: string; source: XpSource; occurredAt: Date; totals: Totals; activityDays?: ActivityDays },
  session: ClientSession,
): Promise<{ player: PlayerState }>;
```

- **Re-sum, not `$inc`.** Both set `totalXp` to `aggregate([{ $match: { userId } }, { $group: { _id: null, sum: { $sum: "$amount" } } }])` (0 when empty), served by the `idx_xpLedger_source` prefix. The totals delta is applied with `$inc` in the same profile update.
- **`replaceSourceXp`** upserts the row by `(userId, sourceType, sourceId)` (`$set amount`, `$setOnInsert occurredAt, createdAt`), re-sums, then applies the high-water rule (below). It is called for every edit, even when `amount` is unchanged.
- **`revokeSource`** deletes the row (none is fine), re-sums, and, when `activityDays` is given, runs the streak recount. Never emits.

### High-water rule (`addXp` and `replaceSourceXp`)

```ts
const newLevel = levelFromTotalXp(profile.totalXp).level;
const leveledUp = newLevel > profile.highestLevel;
if (leveledUp) { /* $set highestLevel: newLevel; emit progression.leveled-up { previousLevel: profile.highestLevel, newLevel } */ }
```

`previousLevel` in the event becomes the previous highest level. New profiles default `highestLevel: 1`.

### Streak recount (inside `revokeSource`)

Let `deletedDay = toLocalDay(occurredAt, timeZone)`, and the stored profile have `streak` and `lastActivityDay`.

1. If `streak === 0`, `lastActivityDay` is null, or `deletedDay` is outside `[addDays(lastActivityDay, -(streak - 1)), lastActivityDay]`: no change.
2. `days = await activityDays.since(addDays(lastActivityDay, -(streak - 1)))`. If `days` contains `deletedDay` (another activity that day): no change.
3. If `days` is non-empty: `{ streak, lastActivityDay } = recountStreak(days)`, the run of consecutive days ending at the latest day in `days`.
4. If empty: `lastActivityDay = await activityDays.latest()`, `streak = lastActivityDay ? 1 : 0`.

`recountStreak` is pure and unit-tested. Display still goes through `calcDisplayStreak`, so a recounted streak whose last day is before yesterday shows as 0.

### Quests API

```ts
export type QuestMeasure = (
  metric: QuestMetric,
  range: { from: Date; toExclusive: Date } | null,   // null = all time
) => Promise<number>;

recountQuestProgress(
  userId: string,
  input: { metrics: QuestMetric[]; occurredAt: Date; timeZone: string; measure: QuestMeasure },
  session: ClientSession,
): Promise<void>;
```

For each quest definition whose `metric` is in `metrics`:

1. `period = getPeriodForCategory(category, occurredAt, timeZone)`; find the user's row for `(questTemplateId, periodStart, periodEnd)`. No row: skip.
2. `range = periodRange(period, timeZone)`: `[startOfLocalDay(periodStart), startOfLocalDay(addDays(periodEnd, 1)))`, or `null` for an all-time period.
3. `progress = min(await measure(metric, range), target)`, `completed = progress >= target`.
4. If the row is `claimed` and `!completed`: `revokeSource({ source: { type: "quest_claim", id: row._id }, occurredAt: now, totals: {} })` and set `claimed: false`.
5. `$set { progress, completed }` (and `claimed` from step 4) on the row.

Metrics per activity: a workout delete recounts `workout_count`; a run edit recounts `run_distance`; a run delete recounts `run_count` and `run_distance`. A workout edit recounts nothing (no quest measures duration or exercises). Training's `measure` counts workouts or runs, or sums **raw** run distance (no rounding), in the range, within the session.

### Training use cases

All run in `session.withTransaction`. Signatures and route handlers are unchanged; a missing activity still returns `null`/`false` and the route answers 404.

| Use case | Steps after the activity write |
|---|---|
| `updateWorkout` | `replaceSourceXp({ amount: xpEarned, occurredAt: workout.date, totals: {} })` |
| `updateRun` | read the old run (session) → update → `replaceSourceXp({ amount, occurredAt: run.date, totals: { distanceKm: new − old } })` → `recountQuestProgress(["run_distance"])` |
| `deleteWorkout` | delete returning the document → `revokeSource({ totals: { workouts: -1 }, activityDays })` → `recountQuestProgress(["workout_count"])` → `emit("activity.reverted")` |
| `deleteRun` | delete returning the document → `revokeSource({ totals: { distanceKm: -distance }, activityDays })` → `recountQuestProgress(["run_count", "run_distance"])` → `emit("activity.reverted")` |

Operations within one transaction run sequentially (no `Promise.all`).

### Events

```ts
"activity.reverted": { userId: string; activity: { type: "workout" | "run"; id: string } };
```

Declared in `src/server/training/events.ts`. No listener in `runtime.ts`.

### Document change

`PlayerProfileDoc.highestLevel: number` (integer ≥ 1), added to the `$jsonSchema` properties and `required` list. No new index: the ledger sum uses the `idx_xpLedger_source` prefix, and activity ranges and days use `idx_workouts_userId_date` and `idx_runs_userId_date`.

## Migration 005: backfill the XP ledger

Idempotent; registered after 004. In batches per collection:

1. **Ledger rows** by `bulkWrite` upserts on `(userId, sourceType, sourceId)` with `$setOnInsert` only, so rows written since 3.1 are untouched:
   - every workout → `workout`, `amount: xpEarned`, `occurredAt: date`;
   - every run → `run`, `amount: xpEarned`, `occurredAt: date`;
   - every `user_quests` row with `claimed: true` whose `questTemplateId` has a definition → `quest_claim`, `amount: xpReward`, `occurredAt: _id.getTimestamp()` (claim time is not stored).
2. **Profiles.** For every profile: `totalXp` = ledger sum, `totalWorkouts` = workout count, `totalDistance` = run distance sum, `highestLevel = max(stored highestLevel, level(old totalXp), level(new totalXp))`. The stored mark is part of the max so a second run cannot lower it.

Test accounts that exploited F-4 lose that XP, which is the intended result (spec D5 table). A second run changes nothing.

## Testing

Integration tests against the in-memory replica set, through the training use cases unless noted:

- **Edit down** a workout: ledger row replaced, `totalXp` equals the ledger sum, level falls across a boundary, no `progression.leveled-up` row.
- **Edit up** a run past a new highest level: `leveledUp`, one event, `highestLevel` raised; `totalDistance` changes by the delta; a run-distance quest becomes completed.
- **Re-earning a level** after a delete emits nothing and returns `leveledUp: false`.
- **Delete** a workout: row and ledger row gone, `totalWorkouts − 1`, `activity.reverted` emitted, daily quest recounted.
- **Clawback**: delete the run behind a claimed quest in a **past** week → claim row revoked, quest unclaimed and incomplete, XP and level drop.
- **Streak**: deleting the only activity in the middle of a streak recounts it; deleting one of two activities on a day leaves it; deleting outside the window leaves it; deleting the only remaining activity sets 0.
- **Missing ledger row**: edit and delete of an activity without one succeed and leave the sum correct.
- **Not found / other user's id**: unchanged 404 and no game-state writes.
- **Migration 005**: builds rows for workouts, runs and claimed quests, keeps existing rows, resets totals and `highestLevel`, and is a no-op on a second run.

Unit tests: `recountStreak` and `periodRange`. Existing route tests for PUT and DELETE keep passing unchanged.

## Known gaps (logged, not fixed here)

- **Edit ignores the exhaustion penalty.** A workout or run logged while exhausted earns full XP once edited, even unchanged. Closes if stamina is removed; otherwise needs the activity to record whether the penalty applied.
- **Achievements on edit.** An edit that raises distance can satisfy a distance achievement without a new level; it unlocks on the next logged activity, since edits emit no `activity.*` event.
- **Quest periods use the current time zone**, not the zone at logging time.
- **Backfill keeps quest claims and streaks as they are** (Decision 11).
- **Claim time** for pre-3.1 quest claims is approximated by the row's creation time.

## Out of Scope

- A confirm dialog previewing the XP and level an edit or delete will cost (Phase 4).
- Changing an activity's date on edit.
- Revoking achievements, refunding stamina, or any level-down notice.
- Compensating-entry ledger or an XP history view.

[[Specs Index]]
