# Specs Index

Index of all design specs in this vault.

## FitLevelUp

- [[Workout Templates Design Spec]] — reusable workout routines users save and pre-fill the log form from
- [[Human Anatomy UI Design Spec]] — interactive muscle model mapped to the `TargetMuscle` enum, with recovery and volume feedback
- [[UI Overhaul Design Spec]] — the "Modern Athletic" direction: OLED blacks, tight density, structured typography, spring-physics interactions
- [[Vercel Deployment Design Spec]] — fail-fast env validation for Redis variables and a visible reconnecting state when SSE drops
- [[Per-User Time Zone Design Spec]] — streaks, quest periods and the dashboard week computed in the user's own IANA time zone (audit F-8)
- [[Architecture Overhaul Design Spec]] — settles audit §7.2 (outbox, polling inbox, rate-limit tiers, boundary tooling, XP ledger, migrations) and fixes the defineRoute, repository, event and schema contracts
- [[Rate Limit Tiers Design Spec]] — standard and expensive Upstash tiers keyed by route + user on every mutation, with Retry-After (audit F-11, step 2.3)
- [[Idempotency Key Header Design Spec]] — UUID Idempotency-Key header on create routes, body fingerprint, 201 replay with Idempotent-Replayed, 422 on reuse (audit F-20, step 2.4)
- [[Transactional Outbox Design Spec]] — typed emit() into an outbox row in the caller's transaction, after() dispatch of own ids, generic daily outbox-sweep cron, dead rows after 8 attempts (step 2.5)
- [[Edit And Delete Reconciliation Design Spec]] — edit and delete replace or revoke the activity's xp_ledger row and re-sum XP (level can fall), adjust totals, recount quests with claim clawback and the streak on delete, highestLevel high-water mark, ledger backfill (audit F-4, step 3.5)
- [[Achievements Social And Notifications Design Spec]] — achievements as an outbox listener, social module with a transition table, batched loading, lazy friend records and a 7-day decline cooldown, notifications inbox with polling, bell and single live toast; SSE retired (steps 3.6–3.8)

## Infra / Meta

- [[Agent Workflow Design Spec]] — the portable feature / fix / refactor pipeline, its project adapter, hooks and decisions
- [[Handbook Sync Step Design Spec]] — the pipeline step that keeps the handbook and guides true as the code changes
