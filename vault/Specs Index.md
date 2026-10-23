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

## Infra / Meta

- [[Agent Workflow Design Spec]] — the portable feature / fix / refactor pipeline, its project adapter, hooks and decisions
- [[Handbook Sync Step Design Spec]] — the pipeline step that keeps the handbook and guides true as the code changes
