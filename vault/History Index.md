# History Index

Index of completed agentic-workflow pipeline runs in this vault. Each line reads `[[Name]] [areas] — summary, type, outcome`. The `workflow` skill's brain scan greps the `**Areas:**` line of these notes before touching code.

## FitLevelUp

- [[Architecture Audit Phase 0 Fix]] [quests, achievements, friends, exercises, templates, auth, database, infra] — audit steps 0.1–0.6 fixed in one PR (4xx mapping, id guards, route security, unique keys, quest sync, friend re-request), fix, agentic
- [[Per-User Time Zone]] [auth, quests, stats, workouts, runs, achievements, database] — streaks, quest periods and the dashboard week computed in each user's IANA time zone (audit F-8), feature-fullstack, agentic
- [[Architecture Overhaul Design Spec]] [infra, database, auth, achievements, friends, quests, workouts, runs] — audit §7.2 settled and the platform contracts fixed (outbox, polling inbox, rate-limit tiers, boundary tooling, XP ledger, schema.ts), spec only, feature-api, manual
- [[Platform Skeleton Refactor]] [infra, database, auth, scripts, tooling] — audit step 2.1: src/server/platform and src/shared, schema.ts with validators, numbered migrations and boundary tooling, refactor, agentic
- [[DefineRoute And UserScopedRepository Refactor]] [infra, auth, database, workouts, runs, exercises, templates, quests, achievements, friends] — audit step 2.2: defineRoute() on every API route, route-table test, userScopedRepository<T>, refactor, agentic
- [[Rate Limit Tiers]] [infra, auth, workouts, runs, exercises, templates, quests, friends] — standard and expensive Upstash tiers keyed by route and user on every mutation, Retry-After on 429, fail-open on limiter outage (audit F-11, step 2.3), feature-api, agentic
- [[Idempotency Key Header]] [infra, workouts, runs, templates] — UUID Idempotency-Key header on the create routes with a body fingerprint, createOnce replay (201 + Idempotent-Replayed) and 422 on reuse, header-only apiFetch retry (audit F-20, step 2.4), feature-fullstack, agentic
- [[Transactional Outbox]] [infra, database, workouts, runs, quests, achievements, friends, scripts] — audit step 2.5: typed emit() into an outbox row in the caller's transaction, lease-based dispatcher with per-listener retry and dead rows, after() dispatch, generic outbox-sweep cron replacing the achievements sweep, npm run outbox, feature-api, agentic
- [[Progression Module Refactor]] [database, auth, workouts, runs, quests, friends, scripts, infra] — audit step 3.1: src/server/progression owns game state in player_profiles, one XP path writing xp_ledger, no __v, computed level, expand-only backfill 003, refactor, agentic
- [[Quests And Training Modules Refactor]] [quests, achievements, workouts, runs, templates, exercises, stats, database, friends, infra] — audit steps 3.2–3.4: definitions as typed constants and migration 004, src/server/quests and src/server/training modules, records and run stats by aggregation, activity dates as instants, refactor, agentic
- [[Edit And Delete Reconciliation]] [workouts, runs, quests, stats, profile, database] — audit step 3.5: edit and delete replace or revoke the xp_ledger row and re-sum XP so levels can fall, totals by delta, quest recount with claim clawback, streak recount on delete, highestLevel high-water mark, migration 005 ledger backfill, feature-api, agentic
