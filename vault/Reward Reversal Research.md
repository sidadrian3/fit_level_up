# Reward Reversal Research

**Status:** Research, 2026-10-24. Input to step 3.5 in [[Architecture Overhaul Audit]].

What should happen to XP, level, claimed quest rewards, achievements and streaks when a user edits down or deletes a logged workout or run (F-4)? This note records what other products and pattern references do, and marks where nothing could be verified. Source labels: **[P]** primary (official docs, help centre, source code, staff replies in an official tracker, official engineering blog), **[W]** community-maintained official wiki, **[A]** anecdotal (user forums).

## Summary for step 3.5

- **XP and level on edit/delete: reverse the XP exactly and let the level fall.** Habitica takes the full XP back when a task is unticked [P]. It keeps the level only because a level-up there refills HP and grants stat points, which it found hard to undo. Its staff chose negative XP over clamping at zero because "I've seen more users disturbed by unearned things in their accounts than by negative experience" [P] (§1). FitLevelUp computes level from `totalXp` and a level-up grants nothing stateful, so Habitica's reason for keeping the level doesn't apply here. Recomputing `totalXp` from the ledger sum (C6) gives the level-down for free.
- **Claimed quest rewards: claw back when the recomputed period progress falls below the target.** Revoke that `quest_claim` ledger row and return the quest to unclaimed, so re-earning it pays out again. Habitica keeps drops and boss damage, but only because "cheating hurts no one but the person doing it" [P]. FitLevelUp sorts friends by XP, so here cheating does affect other people. The stores' refund guidance for granted currency is clawback, down to a negative balance if needed (Google Play [P]), or a rebalance the user is told about (Apple [P]) (§2). Fitness apps don't document what they do (Strava, Garmin: could not verify).
- **Unlocked achievements: keep them.** They carry no XP in `achievement.definitions.ts`. Fitness products appear to keep badges or awards after the data behind them is deleted: Fitbit [A], Apple [A], and Strava trophies can't be removed [A]. Users of Garmin's Double Duty badge treated losing it as a bug [A]. Habitica's one revocation is the exact inverse of an undone check (the 21-day streak achievement) [P] (§3). Don't re-award or re-notify an achievement the user already holds.
- **Streaks: recompute when the deleted activity was the only one on its day.** Strava: "If you delete the only qualifying activity for a given week, your Weekly Streak will end", and restoring the activity updates the streak automatically [P]. Habitica decrements a Daily's streak on untick [P]. An edit that changes only duration or distance leaves the streak alone. An edit that changes the date counts as a delete plus an add (§4).
- **Ledger mechanics: keep the spec's replace-or-delete row (Fowler's *Replacement Adjustment*) and recompute the sum.** Fowler says to use replacement when entries are mutable and you don't need the erroneous history [P]. Compensating entries are the right choice for an immutable ledger (Azure, Modern Treasury [P]), but here they would break the one-row-per-source unique key and the idempotent-by-key behaviour. Upsert and delete by `(userId, sourceType, sourceId)` are idempotent as they stand. Recomputing from the ledger sum, not `$inc`-ing a delta, matches the "regenerable projection" guidance [P]. If support ever needs a "why did my XP drop" trail, the move to reversal entries is a documented refactor (§5).
- **Level-down notification: warn in the confirm dialog, don't broadcast.** Before the edit or delete commits, show the consequence ("removes 120 XP, back to Level 4"). After it commits, show the result in the app only. Apple tells developers to inform customers "by presenting contextual messaging in the app" about refund actions [P]. Duolingo designs around loss aversion and finds a broken streak "demotivating" [P]. Emit no friend notification on level-down. To stop delete-and-relog loops spamming friends with `friend.leveled-up`, consider notifying only above a highest-level-reached high-water mark. That is our own inference, not an observed practice (§5).

## 1. XP and levels when an activity is deleted or reduced

| Product | Behaviour | Evidence |
|---|---|---|
| Habitica (unticking a task) | XP, gold and mana are reversed. The task value is moved back with `_calculateReverseDelta`, and a crit can't apply on untick. | [P] `scoreTask.js` L159–171, L313 ([code](https://github.com/HabitRPG/habitica/blob/11b3150d90e6f93747b2649587ca7d18961d7029/website/common/script/ops/scoreTask.js#L159-L171), [L313](https://github.com/HabitRPG/habitica/blob/11b3150d90e6f93747b2649587ca7d18961d7029/website/common/script/ops/scoreTask.js#L313)). [W] "the player loses the experience points, gold and mana they received" ([Dailies wiki](https://habitica.fandom.com/wiki/Dailies#Unchecking_a_Daily)) |
| Habitica (level after untick) | No level-down. `updateStats` only has a level-up branch and assigns `exp` without a clamp (HP and gold are clamped at 0, XP is not), so XP can go negative. | [P] [`updateStats.js` L15–66](https://github.com/HabitRPG/habitica/blob/11b3150d90e6f93747b2649587ca7d18961d7029/website/common/script/fns/updateStats.js#L15-L66) |
| Habitica (rationale) | "the ramifications of deleveling someone aren't worth having to work up through some negative XP." A floor at 0 was rejected because "the full value should be deducted". "Negative XP is better. I've seen more users disturbed by unearned things in their accounts than by negative experience." Staff summary: negative XP is "simpler, more obvious to the players, and less bug-prone" than reversing a level-up, which also refills HP. | [P] staff in [#5736](https://github.com/HabitRPG/habitica/issues/5736) and [#663](https://github.com/HabitRPG/habitica/issues/663) |
| Habitica (death) | Habitica does level users down elsewhere: at 0 HP you "lost a Level, your Gold, and a piece of Equipment". The pop-up copy is encouraging ("Don't Despair!"). | [W] [Death Mechanics](https://habitica.fandom.com/wiki/Death_Mechanics) |
| Duolingo | Users can't delete a completed lesson, so the question doesn't arise. Could not verify any XP reversal behaviour. | Not documented |
| Strava | Has no XP or levels. Deleting a PR or best effort promotes the next fastest: "If you remove a PR, your next fastest time will become your PR." Stats are derived from the remaining data. | [P] [Best Efforts](https://support.strava.com/en-us/articles/15401661-how-do-best-efforts-work-for-running-on-strava) |
| Nike Run Club | Levels are bands of cumulative distance. The help page only describes "moving you to the next level". Whether deleting a run lowers the level is not documented, and could not be verified. | [P] [NRC Run Levels](https://www.nike.com/help/a/nrc-run-level) |
| Garmin Connect | Levels come from badge points. One forum user reported that total points did not drop when a badge vanished. Official behaviour is not documented. | [A] [Garmin forum](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/143925/garmin-connect-badges-not-being-awarded) |
| Fitbit, Apple Fitness | No XP or level system. Awards are covered in §3. | — |

**Takeaway.** The one product with real XP-and-level semantics and readable code, Habitica, reverses XP exactly and refuses to floor it at zero. It keeps the level for implementation reasons tied to level-up side effects. FitLevelUp has no such side effects (`addXp` only emits `progression.leveled-up`), so a computed level-down is the consistent extension of the same principle.

## 2. Claimed quest or challenge rewards when the qualifying activity is removed

| Product | Behaviour | Evidence |
|---|---|---|
| Habitica (boss quests) | Boss damage from a task is never subtracted on untick: `progress.up` is only incremented on `direction === 'up'`. Staff call it a known, low-priority bug. The issue is still open. | [P] [`scoreTask.js` L178–194](https://github.com/HabitRPG/habitica/blob/11b3150d90e6f93747b2649587ca7d18961d7029/website/common/script/ops/scoreTask.js#L178-L194), [#5648](https://github.com/HabitRPG/habitica/issues/5648) |
| Habitica (drops, collection quest items) | Kept on untick, deliberately. The reasons given: tracking drops is costly; removing a rare drop after an accidental tick would annoy users; "we don't care if people 'cheat' by repeatedly ticking and unticking". | [P] staff in [#4626](https://github.com/HabitRPG/habitica/issues/4626) |
| Strava challenges | The help centre covers eligibility and the trophy case. What happens to progress or a trophy after a deletion is not documented. Community reply: completed trophies can't be removed from a profile. | [P] [Strava Challenges](https://support.strava.com/hc/en-us/articles/216919177-Strava-Challenges). [A] [Community Hub](https://communityhub.strava.com/general-chat-2/delete-challenges-accidentally-entered-3392) |
| Garmin challenges | Not documented, and could not be verified. | — |
| Google Play (voided purchases) | "you can claw back unused items as if they were never purchased … If the user has already spent the currency, consider setting the currency balance to negative and limiting app activity". Also recommends graduated "multiple strikes" and in-app warnings for first offences. | [P] [Play Billing security](https://developer.android.com/google/play/billing/security) |
| Apple (REFUND notification) | "You're responsible to store, monitor, and take appropriate action for each refunded transaction … you might build your own in-game currency-rebalancing logic … Inform customers by presenting contextual messaging in the app for any actions you take". | [P] [Handling refund notifications](https://developer.apple.com/documentation/storekit/handling-refund-notifications) |

**Takeaway.** Two philosophies show up. *Lenient*: Habitica, for a single-player habit tracker where cheating only cheats yourself. *Clawback*: the app stores, wherever the reward has value relative to other people. FitLevelUp's quest XP feeds friend comparison, and F-4 is exactly the "log, claim, delete" exploit, so clawback fits. The ledger makes it cheap: the claim is its own `quest_claim` row, which `revokeSource` can remove when the recomputed period progress falls below the target.

## 3. Achievements and badges already unlocked

| Product | Behaviour | Evidence |
|---|---|---|
| Habitica | Revokes in one case only: unticking a Daily whose streak was a multiple of 21 decrements `achievements.streak` ("Remove a streak achievement if streak was a multiple of 21 and the daily was undone"). Other achievements (e.g. `completedTask`) aren't touched on untick. | [P] [`scoreTask.js` L384–389](https://github.com/HabitRPG/habitica/blob/11b3150d90e6f93747b2649587ca7d18961d7029/website/common/script/ops/scoreTask.js#L384-L389), [L454](https://github.com/HabitRPG/habitica/blob/11b3150d90e6f93747b2649587ca7d18961d7029/website/common/script/ops/scoreTask.js#L454) |
| Strava (segment trophies, PR banners) | Recomputed only when the user asks. "Refresh Activity Achievements" may "permanently lose any existing trophies and medals" and "cannot be undone". Removing a best effort erases its achievement banner. | [P] [Refresh Activity Achievements](https://support.strava.com/en-us/articles/15401858-refresh-activity-achievements), [Best Efforts](https://support.strava.com/en-us/articles/15401661-how-do-best-efforts-work-for-running-on-strava) |
| Garmin Connect | Users report the "Double Duty" badge vanishing after any activity was deleted, and call it a bug. Garmin moderators said they were "investigating". Official policy is not documented. | [A] [Garmin forum: Bug – Double Activity Badge](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/143840/bug---double-activity-badge) |
| Fitbit | Users say unearned badges stay, and only support can remove them, inconsistently. Official policy is not documented. | [A] [Fitbit Community](https://community.fitbit.com/t5/Blaze/Deleting-unearned-badges/td-p/1872497), [2](https://community.fitbit.com/t5/Blaze/I-can-t-delete-unearned-badges/m-p/2809890) |
| Apple Fitness | Users report awards can't be deleted, except by a full Health data reset. Official policy is not documented. | [A] [Apple Community](https://discussions.apple.com/thread/254967989) |
| Nike Run Club | Not documented. | — |

**Takeaway.** Every fitness source found, all of it anecdotal, points to badges persisting. The one primary revocation (Habitica) is narrow and exactly invertible. FitLevelUp achievements are cosmetic, with no XP, so keeping them costs nothing in the economy and avoids a "taking away" moment. When a user crosses a threshold again, the unlock must not fire a second time.

## 4. Streaks when the day's only activity is deleted

| Product | Behaviour | Evidence |
|---|---|---|
| Strava (Weekly Streak) | "If you delete the only qualifying activity for a given week, your Weekly Streak will end." After a restore, "your Weekly Streak will update automatically". A week runs Monday to Sunday. Deleted activities can be restored for 30 days. | [P] [Streaks on Strava](https://support.strava.com/en-us/articles/15401580-streaks-on-strava), [Restore a deleted activity](https://support.strava.com/en-us/articles/15401877-how-do-i-restore-a-deleted-activity) |
| Habitica (per-Daily streak) | Unticking decrements the streak (`task.streak -= 1`). | [P] [`scoreTask.js` L369–389](https://github.com/HabitRPG/habitica/blob/11b3150d90e6f93747b2649587ca7d18961d7029/website/common/script/ops/scoreTask.js#L369-L389). [W] [Dailies wiki](https://habitica.fandom.com/wiki/Dailies#Unchecking_a_Daily) |
| Duolingo | The streak counts "consecutive days you've completed a lesson". Lessons can't be deleted. Leniency comes from Streak Freeze, plus an after-the-fact freeze for outage days. | [P] [Improving the streak](https://blog.duolingo.com/improving-the-streak/), [Streak habit research](https://blog.duolingo.com/how-duolingo-streak-builds-habit/), [Protecting streaks](https://blog.duolingo.com/protecting-streaks-from-site-issues/) |
| Snapchat | A Streak expires after more than a day without a Snap from everyone. Lost streaks can be restored, one free and then paid. The effect of deleting a sent Snap is not documented. | [P] [How Streaks work](https://help.snapchat.com/hc/en-us/articles/7012394193684-How-do-Streaks-work-and-when-do-they-expire), [Restore](https://help.snapchat.com/hc/en-us/articles/7012318024852-I-lost-my-Streak-How-do-I-restore-it) |
| Apple Fitness, Garmin, Fitbit | Not documented. | — |

**Takeaway.** The only documented fitness rule (Strava) treats the streak as derived from the activities that remain. FitLevelUp stores `streak` and `lastActivityDay` on the profile (C6), so a delete that empties a day has to recompute both from the remaining distinct activity days in the user's time zone. That needs a bounded, indexed read over `(userId, date)` across workouts and runs. Rebuilding by `$inc` won't do it.

## 5. Engineering patterns and UX guidance

**Correcting ledger entries (Fowler, accounting patterns, 2006 draft):**

- *Replacement Adjustment*: delete the wrong entries and write the correct ones. Its weakness is that it deletes the erroneous entries and with them the history of the old event. Use it when you don't need that history, or when Event Sourcing can regenerate it. [P] [ReplacementAdjustment](https://martinfowler.com/eaaDev/ReplacementAdjustment.html)
- *Reversal Adjustment*: for each wrong entry, post a reversal with the same date and the opposite sign, plus a new entry. This is "a simple alternative when entries are immutable". Its drawback is "a lot of entries". If entries are mutable, "it's best to use Replacement Adjustment". [P] [ReversalAdjustment](https://martinfowler.com/eaaDev/ReversalAdjustment.html)
- *Difference Adjustment*: one entry for the difference. Pick it if domain experts "prefer a summary". Refactoring from reversal to difference is "not too difficult". [P] [DifferenceAdjustment](https://martinfowler.com/eaaDev/DifferenceAdjustment.html)

**Immutable logs (Azure Architecture Center, Modern Treasury):**

- Event sourcing: "you should never update the event data. The only way to update an entity or undo a change is to add a compensating event". Current state is a projection that can be regenerated, and snapshots are "an optimization, not a replacement". Event handlers "must be idempotent". [P] [Event Sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- Compensating transactions "can fail", so each step should be an idempotent command. Compensation "doesn't necessarily return the system data to its state at the start". [P] [Compensating Transaction pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction)
- Financial ledgers: "In order to undo the effect of a posted Ledger Transaction, you will need to write a second reversing Ledger Transaction". Entries are mutable while pending and immutable once posted. The blog calls all-reversal designs "different but valid" but messier. [P] [Modern Treasury docs](https://docs.moderntreasury.com/ledgers/docs/transaction-status-and-balances), [Enforcing immutability](https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger)

**Applied to `xp_ledger`.** The XP ledger isn't a financial book of record. The workout or run document is the user-facing record, and the ledger is a per-source derivation of it. That puts it in Fowler's "mutable, history not needed" case, so replace-or-delete is a legitimate choice, and it keeps what the reversal style would break:

| Concern | Replace / delete row (spec D6b) | Compensating entry |
|---|---|---|
| Unique `(userId, sourceType, sourceId)` | Kept, one row per source | Needs a second key space (e.g. `workout_reversal`) or a sequence number |
| Idempotent retry | Upsert or `deleteOne` by key is a no-op on repeat | Needs its own unique key per reversal, or double reversals slip through |
| Balance | Ledger sum, recomputed (C6) | Ledger sum, recomputed |
| Audit "why did XP drop" | Lost, beyond the activity's own edit | Kept |
| Backfill and `GAME_CONFIG` replay | Rewrite rows per source | Rewrite or append per source |

Recomputing `totalXp` with `$group $sum` on edit and delete, rather than `$inc`-ing a delta, matches the guidance that the log is the truth and the projection can be regenerated. It also heals any drift in the cache.

**UX and behaviour:**

- Loss aversion: losses weigh more than equal gains (Kahneman & Tversky, *Prospect Theory*, Econometrica 1979, [JSTOR](https://www.jstor.org/stable/1914185)) [P]. Duolingo uses it deliberately, but notes breaking a streak "can have the opposite effect, and actually feel quite demotivating" and offers slack through Streak Freeze [P] ([blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)).
- Tell the user what was taken back. Apple: "Inform customers by presenting contextual messaging in the app" [P]. Google: "displaying in-app warnings" for first offences [P]. Habitica's level-loss pop-up pairs the loss with encouragement [W].
- What these sources never describe: broadcasting a loss to other users. The guidance is all in-app, to the affected user. Not found: any product documenting a friend-facing level-down notice.
- Leniency vs integrity: Habitica's staff accept self-cheating because it is single-player [P] (#4626). The app stores claw back where value is shared [P]. Decide each reward type by whether it's visible to other people.

## Evidence quality

Habitica is backed by source code at commit `11b3150` and staff replies in its own tracker, plus its community wiki. Strava, Nike, Duolingo, Snapchat, Google Play, Apple, Fowler, Azure and Modern Treasury are primary. All Garmin, Fitbit and Apple Fitness badge behaviour, and the Strava trophy-removal point, is anecdotal (user forums) and labelled [A]. Not documented anywhere I could find: Strava and Garmin challenge clawback, NRC level-down, Duolingo XP reversal, and any fitness app's level-down notification.

## Sources

- Habitica source, commit `11b3150`: [scoreTask.js](https://github.com/HabitRPG/habitica/blob/11b3150d90e6f93747b2649587ca7d18961d7029/website/common/script/ops/scoreTask.js), [updateStats.js](https://github.com/HabitRPG/habitica/blob/11b3150d90e6f93747b2649587ca7d18961d7029/website/common/script/fns/updateStats.js)
- Habitica issues: [#663](https://github.com/HabitRPG/habitica/issues/663), [#5736](https://github.com/HabitRPG/habitica/issues/5736), [#4626](https://github.com/HabitRPG/habitica/issues/4626), [#5648](https://github.com/HabitRPG/habitica/issues/5648)
- Habitica wiki: [Dailies](https://habitica.fandom.com/wiki/Dailies), [Death Mechanics](https://habitica.fandom.com/wiki/Death_Mechanics)
- Strava support: [Streaks](https://support.strava.com/en-us/articles/15401580-streaks-on-strava), [Restore a deleted activity](https://support.strava.com/en-us/articles/15401877-how-do-i-restore-a-deleted-activity), [Delete an activity](https://support.strava.com/en-us/articles/15401935-how-do-i-delete-an-activity), [Best Efforts](https://support.strava.com/en-us/articles/15401661-how-do-best-efforts-work-for-running-on-strava), [Refresh Activity Achievements](https://support.strava.com/en-us/articles/15401858-refresh-activity-achievements), [Challenges](https://support.strava.com/hc/en-us/articles/216919177-Strava-Challenges)
- [Nike: NRC Run Levels](https://www.nike.com/help/a/nrc-run-level)
- Duolingo blog: [Streak habit research](https://blog.duolingo.com/how-duolingo-streak-builds-habit/), [Improving the streak](https://blog.duolingo.com/improving-the-streak/), [Protecting streaks](https://blog.duolingo.com/protecting-streaks-from-site-issues/)
- Snapchat support: [How Streaks work](https://help.snapchat.com/hc/en-us/articles/7012394193684-How-do-Streaks-work-and-when-do-they-expire), [Restore a Streak](https://help.snapchat.com/hc/en-us/articles/7012318024852-I-lost-my-Streak-How-do-I-restore-it)
- [Google Play Billing: fraud and voided purchases](https://developer.android.com/google/play/billing/security)
- [Apple: Handling refund notifications](https://developer.apple.com/documentation/storekit/handling-refund-notifications)
- Martin Fowler: [Replacement Adjustment](https://martinfowler.com/eaaDev/ReplacementAdjustment.html), [Reversal Adjustment](https://martinfowler.com/eaaDev/ReversalAdjustment.html), [Difference Adjustment](https://martinfowler.com/eaaDev/DifferenceAdjustment.html)
- Microsoft Azure Architecture Center: [Event Sourcing](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing), [Compensating Transaction](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction)
- Modern Treasury: [Transaction status and balances](https://docs.moderntreasury.com/ledgers/docs/transaction-status-and-balances), [Enforcing immutability](https://www.moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger)
- [Kahneman & Tversky (1979), Prospect Theory](https://www.jstor.org/stable/1914185)
- Anecdotal: [Garmin forum: Double Activity badge](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/143840/bug---double-activity-badge), [Garmin forum: badges not awarded](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/143925/garmin-connect-badges-not-being-awarded), [Fitbit Community 1](https://community.fitbit.com/t5/Blaze/Deleting-unearned-badges/td-p/1872497), [Fitbit Community 2](https://community.fitbit.com/t5/Blaze/I-can-t-delete-unearned-badges/m-p/2809890), [Apple Community](https://discussions.apple.com/thread/254967989), [Strava Community Hub](https://communityhub.strava.com/general-chat-2/delete-challenges-accidentally-entered-3392)

[[Architecture Overhaul Design Spec]]
