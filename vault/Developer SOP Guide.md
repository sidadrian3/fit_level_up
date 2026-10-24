# Developer SOP Guide

How to set up, run, check and change FitLevelUp. For what the system is, start at [[Developer Handbook]].

---

## 1. Prerequisites

- Node.js 20 or newer, npm 9 or newer
- A MongoDB instance for local development (Atlas, or `docker compose up` using `docker-compose.yml`). Tests do not need one.
- An Upstash Redis database (rate limiting and SSE)
- Optional: `gh` (GitHub CLI) for the agent pipeline's issue-tracker step

## 2. First-time setup

1. `npm install` — also installs the Husky git hooks through the `prepare` script.
2. Create `.env.local` with the variables in §3.
3. `npm run seed` — loads the quest and achievement catalogues.
4. `npm run dev` and open `http://localhost:3000`. Use `localhost`, not `127.0.0.1`; Next.js dev mode breaks the login form's navigation on the IP address.

## 3. Environment variables

Validated at startup by `src/server/platform/env/env.ts` (server variables) and `src/lib/env.ts` (`NEXT_PUBLIC_BETTER_AUTH_URL`, the one variable the browser reads); `next.config.ts` imports both, so a missing required variable fails the build, not the first request.

| Variable | Purpose |
|---|---|
| `MONGODB_URI`, `MONGODB_DB` | Database connection and name |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiter and SSE queues |
| `BETTER_AUTH_SECRET` | Session signing (at least 10 characters) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Public base URL of the app |
| `CRON_SECRET` | Required (at least 16 characters); bearer token guarding `/api/cron/*`. Set it in Vercel for production and preview, or the build fails |
| `UI_CHECK_EMAIL`, `UI_CHECK_PASSWORD` | A throwaway dev account used by `scripts/ui-check.mjs` |

## 4. Everyday commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run lint` | ESLint (check only), then the dependency-cruiser rules in `.dependency-cruiser.cjs` (cycles and who may import whom; two cycles in old `src/lib` code are baselined in `.dependency-cruiser-known-violations.json`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:run` | All Vitest tests once, against an in-memory MongoDB replica set |
| `npm test` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run seed` | Seed quest and achievement catalogues |
| `npm run outbox -- --dead` / `-- --requeue <id>` | List dead outbox rows with their last error, or reset one to pending (needs `.env.local`) |
| `npm run build` | Run `migrate-db.ts`, then `next build` |
| `node scripts/check-vault.mjs` | Verify vault wikilinks and the no-marker rule |
| `node scripts/ui-check.mjs --path /dashboard` | Log in and screenshot routes; exits non-zero on console errors |

## 5. The agent pipeline

Work is driven by the `/feature`, `/fix` and `/refactor` skills (or by the intent gate in `AGENTS.md` offering them). Each leaves a spec, a plan and a history log in this vault. The full structure, gates and decisions live in [[Agent Workflow Design Spec]]; the skills in `.claude/skills/` are its local instantiation.

In short: brain scan of the vault → triage → brainstorm → spec → readiness → plan → decision gate (you implement, or the agent does) → task-by-task implementation with checks → verification → handbook sync ([[Handbook Sync Step Design Spec]]) → two-axis code review → history log.

## 6. Hooks that enforce the checks

| Hook | When | Does | Blocks? |
|---|---|---|---|
| Husky `pre-commit` | `git commit` touching `src/` or `tests/` | ESLint on staged TypeScript, `npm run typecheck`, `npm run test:run` | yes |
| Claude `PostToolUse` (Edit, Write) | After each edit under `src/` | Notes a file past ~400 lines so you can check it still has one responsibility | no |
| Claude `Stop` | The agent ends its turn | Typecheck and ESLint on changed files; never tests (a red test is the intended state mid-TDD) | yes |

Never commit with `--no-verify`. The hook and skill files under `.claude/` are local (gitignored); the Husky hook is shared.

The pre-commit hook lints staged files, then runs the dependency-cruiser rules over `src/`, typechecks and runs the full test suite. ESLint ignores the local `.agents/` and `.claude/` folders.

## 7. Branches and commits

- One branch per change; one commit per plan task.
- Commit subjects: `feat|fix|refactor|docs|chore|test(<scope>): <what>`, terse.
- CI (`.github/workflows/ci.yml`) runs lint and tests on pushes and pull requests to `master`.

## 8. Changing the data model

1. Update the document type, the validator and the indexes of the collection in `src/server/platform/database/schema.ts`, and the shared type in `src/lib/types.ts` if the browser sees it. A validator rejects writes that do not match it, so change it together with the code that writes the field.
2. Add an index to the collection's `SCHEMA` entry for any new query shape.
3. Existing documents will not have the new field: read it with a default (see `toUser`), or backfill it with a numbered migration in `src/scripts/migrations/` (add it to `MIGRATIONS` in `index.ts`). `src/scripts/migrate-db.ts` runs the pending migrations and then `applySchema()` on every production build; preview builds skip both. Write migrations to be idempotent, and run a de-duplication migration before the unique index it needs.
4. Update [[Data Model And API Reference]] §2–§3.

## 9. Testing

- Services: integration tests against the in-memory replica set (`vitest.global-setup.ts`), in `src/lib/services/__tests__/`.
- Domain rules: unit tests in `src/lib/domain/__tests__/`.
- Routes with branching: tests in `src/app/api/**/__tests__/`.
- User journeys: Playwright in `tests/e2e/`.
- Tests share one replica set, so files run serially; clean up the data a test creates.

## 10. Vault conventions

See [[README]]. New specs, plans and history logs go in `specs/`, `plans/` and `history/` with Title Case names and an entry in the matching index. Guides state what is true now: rewrite a stale claim in place, with no strikethrough or "Corrected" marker.

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module` from `.next/types/` during typecheck | `rm -rf .next`, then re-run |
| Login form does nothing in dev | Use `http://localhost:3000`, not `127.0.0.1` |
| Build fails on a missing Redis variable | Intended — add the variable to `.env.local` (and to the Vercel project) |
| Transaction errors in tests | Tests need the replica set started by `vitest.global-setup.ts`; run through `npm run test:run`, not a bare `node` script |

[[Guides Index]]
