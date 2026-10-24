# Plans Index

Index of all implementation plans in this vault.

## FitLevelUp

- [[Workout Templates Plan]] — build, manage and use workout templates to pre-fill the workout log
- [[Seal Data Bypass Plan]] — extract template creation into a service so the API route can no longer reach the data layer directly
- [[Vercel Deployment Plan]] — env-level Redis validation and a user-facing SSE reconnect indicator
- [[Architecture Audit Phase 0 Fix Plan]] — fix-forward of audit findings F-1–F-3, F-5–F-7 and F-12–F-14 before the overhaul
- [[Per-User Time Zone Plan]] — per-user IANA time zone for streaks, quest periods and the dashboard week (audit F-8, step 0.7)
- [[Platform Skeleton Plan]] — audit step 2.1: src/server/platform, src/shared, schema.ts with validators, migration runner and boundary tooling
- [[DefineRoute And UserScopedRepository Plan]] — audit step 2.2: defineRoute() for every API route, route-table test, userScopedRepository<T>
- [[Rate Limit Tiers Plan]] — audit step 2.3: standard and expensive tiers keyed by route + user, Retry-After, a tier required on every mutation
- [[Idempotency Key Header Plan]] — audit step 2.4: Idempotency-Key header, body fingerprint, createOnce replay with Idempotent-Replayed, 422 on reuse, header-only apiFetch retry
- [[Transactional Outbox Plan]] — audit step 2.5: transactional emit(), lease-based dispatcher with per-listener retry and dead rows, defineRoute after() dispatch, generic outbox-sweep cron, npm run outbox
- [[Progression Module Plan]] — audit step 3.1: src/server/progression, player_profiles with computed level, xp_ledger from day one, one XP path, no __v, expand-only backfill
- [[Quests And Training Modules Plan]] — audit steps 3.2–3.4: quest and achievement definitions as typed constants, quests module, training module with aggregated records, user-zone activity dates
- [[Edit And Delete Reconciliation Plan]] — audit step 3.5: highestLevel high-water mark, replaceSourceXp/revokeSource with ledger re-sum and streak recount, quest recount with claim clawback, transactional workout and run edit/delete, migration 005 ledger backfill
