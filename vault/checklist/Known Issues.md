# Known Issues

Open issues found while documenting the codebase for the vault (2026-10-20). Neither is fixed yet. When one is fixed, delete its section here and run the pipeline's Handbook Sync so [[Data Model And API Reference]] stops describing it.

---

## 1. `/templates` is not a protected page prefix

**Where:** `protectedRoutes` in `src/proxy.ts` lists `/dashboard`, `/workouts`, `/runs`, `/quests`, `/profile` and `/friends`, but not `/templates`.

**Effect:** `/templates/new` renders for signed-out visitors, because `src/proxy.ts` is the only page-level guard and the `(app)` layout does not check the session. The template API routes still return `401` without a session, so no data leaks. The visitor sees the builder form and then errors on save.

**Fix:** add `/templates` to `protectedRoutes`. `AGENTS.md` ("Routing & URL Management") already requires every authenticated page prefix to be listed there.

**Found in:** `src/proxy.ts`, `src/app/(app)/templates/new/page.tsx`.

## 2. The cron route is open when `CRON_SECRET` is unset

**Where:** `src/app/api/cron/achievements-sweep/route.ts` only rejects a request when `process.env.CRON_SECRET` is set and the `Authorization` header does not match.

**Effect:** if the variable is missing in an environment, anyone can call `GET /api/cron/achievements-sweep` and trigger the sweep over every user. `maxDuration` is 300 seconds, so repeated calls can also burn serverless time. The variable is not declared in `src/env.ts`, so a missing value does not fail the build.

**Fix:** declare `CRON_SECRET` as a required server variable in `src/env.ts` and reject every request that does not carry the matching bearer token.

**Found in:** `src/app/api/cron/achievements-sweep/route.ts`, `src/env.ts`.

[[Guides Index]]
