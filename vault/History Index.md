# History Index

Index of completed agentic-workflow pipeline runs in this vault. Each line reads `[[Name]] [areas] — summary, type, outcome`. The `workflow` skill's brain scan greps the `**Areas:**` line of these notes before touching code.

## FitLevelUp

- [[Architecture Audit Phase 0 Fix]] [quests, achievements, friends, exercises, templates, auth, database, infra] — audit steps 0.1–0.6 fixed in one PR (4xx mapping, id guards, route security, unique keys, quest sync, friend re-request), fix, agentic
- [[Per-User Time Zone]] [auth, quests, stats, workouts, runs, achievements, database] — streaks, quest periods and the dashboard week computed in each user's IANA time zone (audit F-8), feature-fullstack, agentic
- [[Architecture Overhaul Design Spec]] [infra, database, auth, achievements, friends, quests, workouts, runs] — audit §7.2 settled and the platform contracts fixed (outbox, polling inbox, rate-limit tiers, boundary tooling, XP ledger, schema.ts), spec only, feature-api, manual
- [[Platform Skeleton Refactor]] [infra, database, auth, scripts, tooling] — audit step 2.1: src/server/platform and src/shared, schema.ts with validators, numbered migrations and boundary tooling, refactor, agentic
