# Agent Workflow Design Spec

A portable, chat-native agentic workflow for feature development, bug fixes and refactors, built on Claude Code skills and hooks. This file is the **source of truth for the workflow's structure** and is written so it can be carried to a new project: fill in the Project Adapter, then generate the project's skills from the pipelines below.

In a project, the skills (`.claude/skills/{workflow,feature,fix,refactor,code-review}/SKILL.md` — in fit_level_up `.claude/skills` is a symlink to `.agents/skills`, and both are gitignored) are that project's **instantiation** of this spec — they add concrete paths and names where this spec has adapter variables. Each skill carries a header pointing back here. **Structural changes (steps, gates, formats) are made here first**, then applied to the skills.

> **Provenance:** adapted from finance-app's workflow for apartment-system (NestJS + Next.js monorepo, Obsidian vault as the second brain), reworked there after an assessment of 69 logged runs, then ported to fit_level_up (a single Next.js + MongoDB package) by filling in the Project Adapter below. The Decisions section is carried over unchanged: its reasons were learned on apartment-system, and the notes below say where fit_level_up differs.

---

## What kind of workflow this is

In Anthropic's "Building effective agents" terms this is a **workflow** — predefined steps the model follows — not an autonomous agent. It combines:

| Pattern | Where |
|---|---|
| **Routing** | Intent gate + `workflow` skill route to feature / fix / refactor. |
| **Prompt chaining with gates** | Brain scan → triage → brainstorm → classify → spec → readiness → plan → decision → implement → verify → review → history. |
| **Orchestrator–workers** | Plans with ≥ 3 tasks: the main agent coordinates, a fresh sub-agent implements each task. |
| **Evaluator–optimizer** | The inline fix loop (checks → fix → re-check), and code review → fix. |
| **Parallelization (sectioning)** | Code review runs the Standards and Spec axes as independent sub-agents; plan tasks in the same **parallel group** run as concurrent sub-agents in separate git worktrees. |

It also follows **spec-driven development** (spec → plan → tasks), keeps a **human in the loop** at the design, plan and decision gates, and uses a **memory layer** (the brain scan over specs, plans and tagged history).

Deterministic checks are **enforced in code, not prose**: a git pre-commit hook and two Claude Code hooks (see Enforcement).

---

## Pipeline Diagram

```
 User message with strong-signal work language          /feature  /fix  /refactor
 ┌──────────────────────────────────────────────┐              │ (no gate)
 │ Detected: [feature|bug|refactor] — "summary" │              │
 │ Start workflow? [yes / no / just talking]    │              │
 └──────────────────────┬───────────────────────┘              │
                        ▼ yes                                  │
 ┌───────────────────────────────────────────────────────────────▼──────┐
 │ STEP 0 · Brain scan (workflow skill)                                 │
 │   grep history **Areas:** → read Decisions/Notes of hits            │
 │   specs/plans indexes · issue tracker (if gh available, else skip)   │
 │ Classify: feature / fix / refactor  → confirm                        │
 └───────────────┬─────────────────────────┬──────────────────┬─────────┘
                 ▼ feature                 ▼ fix              ▼ refactor
 ┌──────────────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
 │ 1 Triage                     │  │ 1 Triage+repro   │  │ 1 Scope check    │
 │ 2 Brainstorm                 │  │ 2 Diagnose       │  │ 2 Readiness      │
 │ 2b Classify UI/API/full-stack│  │ 3 Readiness      │  │   (+test cover.) │
 │    + small-change lane?      │  │   (root cause    │  │ 3 Grill → plan   │
 │      ├ lane: 1 grill →       │  │    confirmed?)   │  │ 4 Decision gate  │
 │      │  Plan w/ ## Design    │  │ 4 Plan           │  │ 5 Implement      │
 │      └ full: grill → spec →  │  │ 5 Grill → gate   │  │ 5b Handbook sync │
 │        3.5 design → 4 Ready- │  │ 6 Fix (TDD)      │  │    (standalone)  │
 │        ness → grill → plan   │  │ 6b Handbook sync │  │ 6 Review         │
 │ 6 Decision gate A/B          │  │    (standalone)  │  │ 7 Commit         │
 │   A: task.md incl. 7c item   │  │ 7 Review         │  │ 8 History        │
 └──────────────┬───────────────┘  │ 8 Commit         │  └──────────────────┘
                ▼ B                │ 9 History        │
                                   └──────────────────┘
 ┌──────────────────────────────────────────────────────────────────────┐
 │ STEP 7 · Implement, task by task                                     │
 │   ≥3 tasks: fresh sub-agent per task (sequential, never commits)     │
 │   <3 tasks / lane: main agent                                        │
 │   per task: lint(changed) → typecheck → task tests                   │
 │     fail → inline fix, ≤3 attempts → escalate [diagnose|revise|stop] │
 │   size check (>~400 lines) → responsibility check → refactor if 2    │
 │   plan wrong → revise plan in place → continue? [yes/stop]           │
 │   commit per task  ◄── pre-commit hook: lint staged·typecheck·tests  │
 │   end of turn      ◄── Stop hook: typecheck + lint on changed files  │
 ├──────────────────────────────────────────────────────────────────────┤
 │ STEP 7b · Verify: full lint/typecheck/tests per touched package      │
 │   UI/full-stack: Playwright over touched routes, screenshots,        │
 │   console errors = failures (MCP, or ui-check script fallback)       │
 ├──────────────────────────────────────────────────────────────────────┤
 │ STEP 7c · Handbook sync (coordinator, in-context) — diff             │
 │   <base-commit>..HEAD through Developer Handbook §5, update the      │
 │   mapped notes + any stale guide claim, commit                       │
 │   "docs(vault): update handbook for <name>", or report               │
 │   "Handbook: no update needed — <why>"                               │
 │   (fix 6b / refactor 5b: standalone only, skipped in Contained Mode) │
 ├──────────────────────────────────────────────────────────────────────┤
 │ STEP 8 · Code review: Standards ∥ Spec sub-agents                    │
 │   Standards = repo docs + smell baseline + REPO_REVIEW_CHECKLIST     │
 │   (incl. Docs — judgement call: stale handbook/guide claim)          │
 ├──────────────────────────────────────────────────────────────────────┤
 │ STEP 9 · History log (Areas/Surfaces tags, + Handbook: line)         │
 │   → History Index                                                    │
 └──────────────────────────────────────────────────────────────────────┘
```

---

## Project Adapter

Everything project-specific lives here. The pipelines below refer to these names. Values shown are fit_level_up's.

```
BRAIN_DIR        = vault
SPEC_DIR         = {BRAIN_DIR}/specs          # searched recursively; index: Specs Index.md
PLAN_DIR         = {BRAIN_DIR}/plans          # index: Plans Index.md
HISTORY_DIR      = {BRAIN_DIR}/history        # index: History Index.md
ISSUE_TRACKER    = GitHub Issues via `gh`; config in AGENTS.md "## Agent skills"
AGENT_RULES      = AGENTS.md (single package, no per-package rules files)

PACKAGES         = one Next.js 16 App Router package at the repo root (Vitest, Playwright e2e)
CHECK_CMDS       = lint (changed)  git diff --name-only --diff-filter=ACMR <base>..HEAD -- '*.ts' '*.tsx' | xargs -r npx eslint
                                   (check-only, never --fix; a whole-repo `npm run lint` still reports
                                    pre-existing errors, so the pipelines lint changed files only)
                   typecheck       npm run typecheck
                   test            npm run test:run        (`npm test` is watch mode: never use it in a pipeline)
                   lint one file   npx eslint <files>
                   test one file   npx vitest run <file>
FULL_STACK_ORDER = data / domain / service / route tasks before page and component tasks

SIZE_LIMIT          = 400 lines, under src/
SIZE_LIMIT_EXCLUDES = *.test.ts(x), constants/, components/ui/

UI_VERIFY        = Playwright MCP (@playwright/mcp pinned, not @latest)
                   fallback: node scripts/ui-check.mjs --path <p> [--path ...] [--email <e>]
                   base URL http://localhost:3000 — never 127.0.0.1 (Next 16 dev breaks login nav)
TEST_LOGINS      = no seeded users and no roles. Sign up a throwaway account at /signup and put
                   UI_CHECK_EMAIL / UI_CHECK_PASSWORD in .env.local. A feature involving a second
                   person (friends) uses a second throwaway account with the same password
                   (--email overrides UI_CHECK_EMAIL).

AREA_VOCAB       = auth, workouts, runs, templates, exercises, quests, achievements, friends,
                   stats, profile, sse, database, infra
SURFACE_VOCAB    = ui, api-only, cron

SMALL_LANE_MAX   = ≤5 files · no new collection, index or document-shape change ·
                   no auth, proxy or userId-scoping change · ≤2 plan tasks
SUBAGENT_MIN     = 3 tasks
FIX_ATTEMPTS     = 3
PARALLEL_MAX     = 3 sub-agents per group
WORKTREE_LINKS   = node_modules, .env.local
                   # gitignored paths a fresh worktree lacks; symlinked from the main checkout
UNIT_TEST_ONLY   = n/a — every `vitest run` starts its own in-memory MongoDB replica set, so parallel
                   sub-agents do not share a database and may run the full suite
```

### REPO_REVIEW_CHECKLIST

Pasted into the Standards reviewer's prompt next to the smell baseline.

**Security — may be hard violations:**

- Every new or changed route handler under `src/app/api` (except `health`, `auth/[...all]` and `cron/*`) calls `getAuthUserId()` before anything else; every cron route verifies `CRON_SECRET`.
- Every read or write of user-owned data filters by the session's `userId`. Fetching, updating or deleting by `_id` alone, or trusting a client-supplied `userId`, is an IDOR.
- Every request body or query parameter is parsed by a Zod schema from `src/lib/validations/schemas.ts` before it reaches a service; pagination inputs are clamped.
- Errors leave a route only through `handleApiError` and `AppError` subclasses — no hand-rolled error JSON, no internals in messages.
- Routes that create data are rate-limited (`RateLimit`) unless the spec says why not (judgement call for routes that currently are not).
- A new authenticated page prefix is added to `protectedRoutes` in `src/proxy.ts`.
- No secrets, tokens, passwords or PII in logs, errors, SSE payloads or client bundles (only `NEXT_PUBLIC_*` reaches the browser).

**Performance and data integrity — judgement calls:**

- No N+1: no `-db.ts` call inside a loop over rows that one `$in` query, aggregation or `bulkWrite` could handle.
- List endpoints are paginated or otherwise bounded.
- No read-modify-write across an `await` (lost update): use `$inc`/`$set`, a `bulkWrite` upsert or a transaction; multi-collection writes use `session.withTransaction` and pass the `session` into every call.
- A create a retry could repeat carries an `idempotencyKey` with a unique index, and recovers from a duplicate-key error by returning the existing entity.
- A new query shape has an index in `ensure-indexes.ts`.
- No O(n²) work over collections that grow with a user's history.
- React Query: keys include every variable the fetch depends on; mutations invalidate every affected key across features; no raw `fetch()` (use `apiFetch`).

**Docs — judgement calls:**

- A handbook or guide claim this diff makes untrue.
- A [[Developer Handbook]] §5 mapping the diff triggered (new route, collection, index, page, service, script, env var, hook, game rule) that Step 7c didn't update.

### Project-specific reuse lists (feature Step 5 / Step 7)

- **Server:** `getAuthUserId`; `handleApiError` + `AppError` subclasses; Zod schemas in `lib/validations/schemas.ts`; `getCollection` / `getDbConfig` (no hardcoded collection names); the `session` parameter pattern from `logWorkout`; `UserStateService` for every XP/level/streak/stamina change; `lib/config/game-config.ts` for tuning values; `lib/sse/` for live events; `after()` for non-critical side-effects.
- **Client:** `components/ui/` primitives; `apiFetch` and the wrappers in `lib/data/api-client/`; TanStack Query hooks with cross-feature invalidation; `lib/constants/` (including `navigation.ts`); Tailwind v4 tokens from `globals.css`.
- **UI design:** Step 3.5 runs the design-quality skills against the spec, checking it against [[UI Overhaul Design Spec]]. There is no Claude Design hand-off in this project.

---

## Entry Points

**Natural language, with the intent gate** (rule lives in `{AGENT_RULES}`):

- Strong signals trigger it — action verbs (`let's`, `build`, `add`, `implement`, `create`, `fix`, `refactor`, `clean up`, `extract`) and bug language (`broken`, `crash`, `error`, `not working`, `failing`).
- Never intercepted: messages starting `what if`, `I think`, `should we`, `could we`, `I noticed`; questions (ending `?`); replies inside an active brainstorm/plan; slash commands.

```
Detected: [feature / bug / refactor] — "[one-line summary]"
Start workflow? [yes / no / just talking]
```

`yes` → `workflow` skill · `no` → conversation · `just talking` → conversation, gate off for the session.

**Slash commands** `/feature`, `/fix`, `/refactor` bypass the gate.

---

## Step 0: Brain Scan (workflow skill, every pipeline)

Before reading source code, one reported line per lookup:

1. **History by area** — pick the request's areas from `AREA_VOCAB`, `grep -lE '^\*\*Areas:\*\*.*\b(<area>|…)\b' {HISTORY_DIR}/*.md`, read the hits' **Decisions made** and **Notes**. Filename match is a second pass.
2. **Specs** — `Specs Index` and `{SPEC_DIR}` filenames.
3. **Plans** — `Plans Index` and `{PLAN_DIR}` filenames.
4. **Issue tracker** — only if `command -v gh && gh auth status` succeeds; else `Issue tracker: skipped (gh unavailable)`.

On hit: `Found: <file> — loading context.` and don't re-ask what it answers. On miss: `Brain scan: no prior context found.` and read only directly relevant files.

**Classification** here is only `feature / bug fix / refactor`, confirmed with the user. UI / API / full-stack is decided in the feature pipeline after the brainstorm.

---

## Readiness Block (replaces confidence percentages)

Shown before the plan (feature full pipeline), after diagnosis (fix), after scope (refactor). Skipped in Contained Mode and in the small-change lane (whose assumptions live in the plan's `## Design` section).

```
Readiness:
  Open questions:   <each unresolved question, or "none">
  Assumptions:      <each assumption made without confirmation, or "none">
  Riskiest part:    <one line — where this is most likely to go wrong>
```

- **Fix** adds `Root cause: confirmed (<how: failing test / live repro / trace>) / suspected`.
- **Refactor** adds `Preserved behavior covered by tests: yes — <which> / no — <what's missing>`.

**Rules:** any open question → pause and ask, one at a time. `Root cause: suspected` → pause. Coverage `no` → characterization tests become the plan's first task. Assumptions don't block; the user may veto one.

---

## Pipeline: Feature

```
Step 1   Triage — issue tracker (if gh available) · codebase redundancy by domain concept
         wontfix / already exists → stop · needs-info → ask
Step 2   Brainstorm (brainstorming skill) — requirements, data shape, contract;
         scan existing components, -db modules, services, errors, Zod schemas first.
         Motion/gesture work: apple-design, animation-vocabulary.
         Visual gate: "Visuals use more tokens. Generate a diagram? [yes / skip]"
Step 2b  Classify from the layers the design touches:
           Type: [UI / API / full-stack] — touches <pages/components | routes/services/domain/data>: <why>
         Evaluate SMALL_LANE_MAX → "Small-change lane qualifies: <why>. Use it? [yes / full pipeline]"
         (no prompt if any criterion fails)
         Lane: skip 3, 3.5, 4 · one grill · one {PLAN_DIR}/<Name> Plan.md with ## Design first
Step 3   Grill → ### Thought Process → {SPEC_DIR}/<Name> Design Spec.md (+ Specs Index)
         Full-stack: route contract (request and response shapes) before any UI section
Step 3.5 UI/full-stack: design-quality critique pass (see adapter) — no Claude Design hand-off here
Step 4   Readiness block
Step 5   Grill → ### Thought Process → plan via to-spec → {PLAN_DIR}/<Name> Plan.md (+ Plans Index)
         Codebase scan first (reuse lists) · new UI dependency → pick-ui-library
         Plan rules (below) · commit "docs(vault): <name> spec and plan"
Step 6   Decision gate:
           Design complete. How do you want to proceed?
             A) I'll implement myself   → task.md (tasks as - [ ] + Readiness
                                           + a Step 7c Handbook sync checklist item), stop
             B) Full agentic — go       → record HEAD as <base-commit>
Step 7   Implement (see Implementation) — server work: TDD (tdd skill) · UI: no new tests by default
Step 7b  Verify (see Verification)
Step 7c  Handbook sync (see Handbook Sync)
Step 8   Code review — fixed point <base-commit>, spec = design spec (lane: the plan)
         Fix hard violations / missing requirements, commit follow-up
Step 9   History log (+ History Index, + Handbook: line)
```

## Pipeline: Fix

```
Step 1   Triage — issue tracker (if gh available) · reproduce and confirm the bug
Step 2   Diagnose (diagnosing-bugs skill) — no fix until root cause is established
Step 3   Readiness (+ Root cause confirmed/suspected)
Step 4   Standalone only: {PLAN_DIR}/<Bug> Fix Plan.md via to-spec, commit it
Step 5   Grill → ### Thought Process → decision gate (A: task.md incl. a 6b Handbook sync item · B: record <base-commit>)
Step 6   Minimal fix — server: failing test first · UI: fix directly, run touched Vitest,
         verify in browser via UI_VERIFY if user-visible
         Checks → inline fix loop
Step 6b  Standalone only: Handbook sync (see Handbook Sync)
Step 7   Code review — fixed point <base-commit>, spec = fix plan (Contained: Standards only)
Step 8   Commit "fix(<scope>): <description>"
Step 9   Standalone only: history log (+ Handbook: line)
```

**Contained Mode** — entered only from a feature escalation where the user chose `diagnose`. Skips triage, readiness, plan, decision gate, Handbook sync and history; ends with the Interrupt Summary.

## Pipeline: Refactor

```
Step 1   Scope check — responsibility, in/out of scope, preserved behaviour
Step 2   Readiness (+ Preserved behavior covered by tests)
Step 3   Grill → ### Thought Process → request-refactor-plan → {PLAN_DIR}/<Name> Plan.md, commit it
Step 4   Decision gate (A: task.md incl. a 5b Handbook sync item · B: record <base-commit>)
Step 5   Incremental commits, each green: lint (changed) + typecheck + tests
         ≥ SUBAGENT_MIN tasks → sub-agent per task · failing step → inline fix loop, else revert it
         Never mix refactor commits with feature/fix commits
Step 5b  Standalone only: Handbook sync (see Handbook Sync)
Step 6   Code review — spec axis checks interface unchanged, behaviour preserved
Step 7   Final commit "refactor(<scope>): …" if anything is pending
Step 8   Standalone only: history log (+ Handbook: line)
```

**Contained Mode** — entered from the feature pipeline's size check. Stash the in-flight feature change first. Skips readiness, decision gate, Handbook sync and history; the plan may be a short in-conversation list. Ends with the Interrupt Summary.

---

## Plan Rules (all pipelines)

1. Discrete, sequential tasks — one deliverable each.
2. Each task ends with its own commit step; the commit is part of the task.
3. Every commit leaves the codebase buildable and green.
4. Commit messages: `feat|fix|refactor|docs|chore(<scope>): <what>` — terse, subject only.
5. Codebase scan first; every task names what it reuses.
6. Full-stack: each task names its layer (route, service, domain, data, page, component); `FULL_STACK_ORDER` applies.
7. **Parallel groups (optional).** A task may carry `**Group:** <letter>` and must then carry `**Files:** <every file it creates or edits>`. Tasks in one group:
   - don't use each other's output, and depend only on tasks in earlier groups or earlier ungrouped tasks;
   - have **disjoint `Files:` lists**, including shared type, schema, index and navigation files. The usual collision is two tasks each editing the same shared file (`types.ts`, `schemas.ts`, `ensure-indexes.ts`, `navigation.ts`, `proxy.ts`); move that edit into one task or keep them sequential;
   - number at most `PARALLEL_MAX`.

   Each group carries one line saying why its tasks are independent. Ungrouped tasks run alone, in order. Groups are optional: a plan whose tasks form a chain has none.
8. **Contract before parallel UI.** Under `FULL_STACK_ORDER`, a UI task may share a group with API tasks only if the API task that introduces the contract (Zod schema, response type, the route's shape) is in an **earlier** group or is an earlier ungrouped task. The UI is then built against contract code that has committed, not against spec text.

---

## Implementation (feature Step 7; refactor Step 5)

### Who implements

- Plan has ≥ `SUBAGENT_MIN` tasks (full pipeline): the main agent coordinates; each ungrouped task goes to one fresh `general-purpose` sub-agent, **sequentially, in the foreground**. Each parallel group runs as described in *Parallel groups* below.
- Otherwise (and in the small-change lane): the main agent implements. Groups are ignored; tasks run in plan order.

### Sub-agent hand-off contract

The prompt contains: the task text verbatim · the spec (or lane plan) path · "read `{AGENT_RULES}`" · the task's reuse list · one line + SHA per completed task · the per-task checks and the inline fix loop · "do not commit, do not edit the plan, report if the plan is wrong".

It returns:
```
Files changed:          <list>
Checks:                 lint ✓ typecheck ✓ tests ✓   (or the escalation block)
Deviations from plan:   none / <what and why>
Plan-wrong signal:      none / <problem>
```

The main agent then reads the diff, runs the size check, handles plan-wrong/escalations with the user, and commits with the plan's message.

### Parallel groups

For a group of 2 or more tasks:

1. **Base.** Record the current `HEAD` as `<group-base>`. All group tasks start from it.
2. **Spawn.** In **one message**, spawn one `general-purpose` sub-agent per task with `isolation: "worktree"`, in the background. The hand-off contract is unchanged, plus:
   - First step: symlink each `WORKTREE_LINKS` path from the main checkout into the worktree (`ln -s <main>/<path> <worktree>/<path>`). Without them there is no `node_modules` or env, and no check can run.
   - Stay inside your worktree; touch only the task's `Files:`. Needing any other file is a plan-wrong signal: stop and report it.
   - `UNIT_TEST_ONLY` does not apply: each test run starts its own in-memory replica set, so the full suite is safe to run in the worktree.
   - Return the worktree path and branch in the report.
3. **Commit per task.** As each sub-agent returns, the coordinator reads its diff in the worktree, runs the size check, and commits there with the plan's message (`git -C <worktree> commit`). The pre-commit hook runs inside that worktree. Commits happen one at a time, never concurrently: every commit runs the full suite through the pre-commit hook, and several replica sets at once are slow and memory-hungry.
4. **Merge in plan order.** Once every task in the group has committed, cherry-pick each task's commit onto the feature branch in plan order.
   - A cherry-pick conflict means the `Files:` lists weren't really disjoint. Run `git cherry-pick --abort`, report it as `Plan wrong detected at Task <N>: files overlap with Task <M>`, and re-run that task **sequentially** on the merged branch.
5. **Group gate.** Every task passed on its own; the combination may not. Run lint (changed files), `npm run typecheck` and `npm run test:run`. A failure enters the inline fix loop, and the fix is committed as `fix(<scope>): integrate group <letter>`.
6. **Clean up.** Remove each group worktree and its branch (`git worktree remove`, `git branch -D`). Worktrees that have commits are not auto-cleaned.

An escalation or plan-wrong signal from any group task stops the whole group before merging. Nothing from that group reaches the feature branch until the user decides. Tasks that already committed in their worktrees stay there, ready to cherry-pick once the problem is resolved.

### Inline fix loop

After each task: lint (changed files) → typecheck → the task's tests. On failure, fix in place and re-run, up to `FIX_ATTEMPTS` per task; a recurring identical error counts once. Fixes go into the task's own commit. No sub-pipeline, no resume prompt. A commit blocked by the pre-commit hook or a turn blocked by the Stop hook enters the same loop and counter. Never `--no-verify`.

After the last attempt, inside the **feature** pipeline:
```
Check still failing after 3 attempts at Task <N>: <lint / typecheck / test>
  Last error:   <trimmed output>
  Tried:        <one line per attempt>
Options: [diagnose — run fix pipeline in Contained Mode / revise plan / stop]
```

Inside the **fix** and **refactor** pipelines there is nothing further to escalate to: stop and show the last error and what was tried (a refactor step that can't be made green is reverted).

### Size check → responsibility check

The PostToolUse hook warns when a file passes `SIZE_LIMIT`. Before committing a task, any modified file over the limit triggers a responsibility check. The contained refactor runs only when the file is found to have two responsibilities; otherwise the task commits as is. When the refactor runs:
```
File <filename> is <N> lines and has two responsibilities.
Invoking refactor interrupt. [CallerContext: feature: <Name>, Task <N>]
```
→ `refactor` in Contained Mode → Interrupt Summary → `Resume feature pipeline? [yes / stop]`.

### Plan-wrong interrupt

```
Plan wrong detected at Task <N>: <problem>
Revising plan before continuing.
```
Update the plan file in place, show the diff, then `Plan revised. Changes: … Continue with revised plan? [yes / stop]`. Completed tasks are not re-run.

### Interrupt Summary (Contained Mode exit)

```
Interrupt complete: [fix / refactor]
  Triggered by:   [lint / type error / test failure / file too large / bad pattern / manual]
  CallerContext:  feature: <Name>, Task <N>
  Files changed:  [list]
  Commits added:  [N]

Resume feature pipeline? [yes / stop]
```

---

## Verification (feature Step 7b)

1. Lint (changed files since `<base-commit>`), `npm run typecheck`, `npm run test:run`; failures → inline fix loop; commit as `fix(<scope>): pre-review cleanup`.
2. **UI / full-stack — required.** dev server up with a reachable database · browser at the adapter's base URL · log in with the throwaway account (`TEST_LOGINS`; a second account when the feature involves another person) · visit every touched route · walk the reachable key states (happy, empty, error) · screenshot each · any console error or broken state → inline fix loop. Output:
   ```
   UI verified:     <route × account, ...>
   Screenshots:     <paths>
   Console errors:  none
   ```
3. Animation/transition code changed → `review-animations`.

---

## Handbook Sync (feature Step 7c; fix Step 6b, refactor Step 5b, standalone only)

Runs after Verification, before code review, so the Standards reviewer sees the doc edits alongside the code. In `fix` and `refactor` it runs only standalone: in Contained Mode the parent feature's own Step 7c covers the interrupt's changes. The coordinator runs it in-context, never a sub-agent, even on a plan with ≥ `SUBAGENT_MIN` tasks: it's one short diff-driven docs pass over a change the coordinator already holds in full.

1. `git diff --name-only <base-commit>..HEAD`.
2. Map each changed file through [[Developer Handbook]] §5:
   - API route / auth / rate limit → Data Model And API Reference §4
   - collection / field / enum / index → Data Model And API Reference §2–§3
   - page / navigation → Data Model And API Reference §5
   - service / domain rule / layering → Domain Architecture
   - script / env var / hook / command → Developer SOP Guide
   - infra / auth flow / SSE / rate limiting / cross-cutting rule → Architecture Review
   - game rule or user-visible behaviour → Project Briefing
   - templates / muscle model → Workout Templates Anatomy
   - new guide → Guides Index + Developer Handbook §3
3. Update the mapped notes to match the code. Where the change made a guide claim untrue, rewrite the claim in place so the guide states what is true now, in the present tense. Leave no strikethrough, no dated "Corrected" marker and no "added later" label: git and the history log record what changed. Keep the reason for the current design; a decision the change reversed leaves the guide and stays in its spec.
4. Commit `docs(vault): update handbook for <name>` — or, if nothing in the diff maps to §5 and no guide claim went stale, report `Handbook: no update needed — <why>` and commit nothing.

A vault-only change reports `Handbook: no update needed — docs-only change` unless it itself contradicts a handbook note.

---

## Code Review Contract

Invoke `code-review` with **fixed point** `<base-commit>` and **spec path** (design spec, lane plan, fix plan or refactor plan). Two parallel `general-purpose` sub-agents:

- **Standards** — `{AGENT_RULES}` + the Fowler smell baseline + `REPO_REVIEW_CHECKLIST`. Documented-standard and security breaches can be hard violations; smells and performance items are judgement calls.
- **Spec** — missing requirements, scope creep, wrong implementations, each quoting the spec line.

Reported side by side, never merged or re-ranked. Spec discovery order: caller's path → `{SPEC_DIR}` → a `{PLAN_DIR}` plan with `## Design` → issue refs (if `gh`).

---

## History Log Format

`{HISTORY_DIR}/<Name>.md` (`<Bug> Fix.md`, `<Name> Refactor.md`), Title Case, no date prefix:

```markdown
# <Name>

**Type:** feature-ui / feature-api / feature-fullstack / fix / refactor
**Areas:** <from AREA_VOCAB>
**Surfaces:** <from SURFACE_VOCAB>
**Pipeline outcome:** agentic / manual
**Lane:** full / small-change            (features only)

## Readiness at start

<assumptions · riskiest part · root cause (fix) · test coverage (refactor)>

## What was built / fixed / refactored

<1-3 sentences>

## Root cause                              (fix only)

## Decisions made

- <decision>: <why>

## Verification

Escalations: <none, or one line each>
UI verified: <route × account, or n/a>
Handbook: <notes updated, comma-separated, or "none needed — <why>">

## Notes

<anything useful for future work in this area>
```

Index line: `- [[<Name>]] [<areas>] — <one-line summary>, <type>, <outcome>`.

---

## Enforcement

Checks that must always run are code, not instructions.

| Hook | When | Does | Blocks? |
|---|---|---|---|
| git pre-commit (Husky) | `git commit` touching `src/` or `tests/` | ESLint on staged TypeScript (no fix) → `npm run typecheck` → `npm run test:run`; docs-only commits skip | yes |
| Claude Code `PostToolUse` (Edit\|Write) | after each edit | warns when a file under `src/` passes `SIZE_LIMIT` (excludes applied); prompts a responsibility check | no — notice only |
| Claude Code `Stop` | agent ends its turn | typecheck + ESLint on changed files under `src/` and `tests/`; never tests (a red TDD step must be allowed to end a turn); skips when `stop_hook_active` | yes |

Set-up in a new project: `npm install --save-dev husky playwright`, add `"prepare": "husky"`, a `typecheck` script and a one-shot `test:run` script, then copy the files below and edit only the config block at the top of each (`PACKAGES` in the hooks; the constants block in `ui-check.mjs`).

The copies below are generated from the real files — when a hook file changes, re-embed it here in the same commit rather than hand-editing either copy.

### `.husky/pre-commit`

```sh
# Single-package repo: the same three checks apply to the whole app.
set -e

if [ -z "$(git diff --cached --name-only --diff-filter=ACMR -- src tests)" ]; then
  exit 0
fi

echo "pre-commit: checking src ..."

# Never --fix here: a hook must not rewrite what is about to be committed.
if git diff --cached --name-only -z --diff-filter=ACMR -- '*.ts' '*.tsx' \
    | xargs -0 -r npx eslint; then :; else
  echo "pre-commit: lint failed"
  exit 1
fi

npm run typecheck || { echo "pre-commit: typecheck failed"; exit 1; }
npm run test:run || { echo "pre-commit: tests failed"; exit 1; }
```

### `.claude/settings.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/workflow-guardrails.mjs"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/workflow-guardrails.mjs"
          }
        ]
      }
    ]
  }
}
```

### `.claude/hooks/workflow-guardrails.mjs`

```js
#!/usr/bin/env node
// Tests are deliberately absent from the Stop check: a red test is the intended state mid-TDD.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const PACKAGES = [{ dir: ".", name: "app" }];

const SIZE_LIMIT = 400;
const SIZE_LIMIT_EXCLUDES = [
  /\.spec\.ts$/,
  /\.test\.tsx?$/,
  /(^|\/)constants\//,
  /(^|\/)components\/ui\//,
];

function readStdinJson() {
  const raw = readFileSync(0, "utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

function projectRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
}

function isExcludedFromSizeLimit(relPath) {
  return SIZE_LIMIT_EXCLUDES.some((re) => re.test(relPath));
}

function handlePostToolUse(input, root) {
  const filePath = input.tool_input?.file_path;
  if (!filePath) return;

  const relPath = path.relative(root, filePath).replace(/\\/g, "/");
  if (!relPath.startsWith("src/")) return;
  if (isExcludedFromSizeLimit(relPath)) return;

  let lineCount;
  try {
    const contents = readFileSync(filePath, "utf8");
    lineCount = contents.split("\n").length;
  } catch {
    return; // file may have been deleted since the edit
  }

  if (lineCount > SIZE_LIMIT) {
    process.stderr.write(
      `${relPath} is ${lineCount} lines (over ~${SIZE_LIMIT}) — check that it still has one responsibility; split only if it has two (AGENTS.md "No God Classes").\n`,
    );
    process.exit(2); // fed back to Claude as a notice; does not undo the edit
  }
}

// -z gives raw paths (no quoting) and lists a rename's original path as a
// separate entry; -uall expands new directories into their files.
function listLiveChangedPaths(root) {
  const entries = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "-uall"],
    { cwd: root, encoding: "utf8" },
  ).split("\0");

  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const status = entry.slice(0, 2);
    if (status.includes("R") || status.includes("C")) i++;
    if (status.includes("D")) continue;
    paths.push(entry.slice(3));
  }
  return paths;
}

function changedFilesByPackage(root) {
  const byPackage = new Map(PACKAGES.map((p) => [p.dir, []]));
  for (const filePath of listLiveChangedPaths(root)) {
    const pkg = PACKAGES.find(
      (p) =>
        p.dir === "."
          ? /^(src|tests)\//.test(filePath)
          : filePath.startsWith(`${p.dir}/`),
    );
    if (pkg) byPackage.get(pkg.dir).push(filePath);
  }
  return byPackage;
}

function handleStop(input, root) {
  if (input.stop_hook_active) return; // never loop on our own re-invocation

  const byPackage = changedFilesByPackage(root);
  const failures = [];

  for (const pkg of PACKAGES) {
    const files = byPackage.get(pkg.dir);
    if (!files || files.length === 0) continue;

    try {
      execFileSync("npm", ["run", "--silent", "typecheck"], {
        cwd: root,
        stdio: "pipe",
      });
    } catch (err) {
      failures.push(
        `[${pkg.name}] typecheck failed:\n${err.stdout}${err.stderr}`,
      );
    }

    const relFiles = files
      .filter((f) => /\.tsx?$/.test(f) && !f.startsWith(".claude/"))
      .map((f) => path.relative(pkg.dir, f));
    if (relFiles.length === 0) continue;
    try {
      execFileSync("npx", ["eslint", ...relFiles], {
        cwd: path.join(root, pkg.dir),
        stdio: "pipe",
      });
    } catch (err) {
      failures.push(`[${pkg.name}] lint failed:\n${err.stdout}${err.stderr}`);
    }
  }

  if (failures.length > 0) {
    process.stderr.write(
      `Stop blocked — fix before ending the turn:\n\n${failures.join("\n\n")}\n`,
    );
    process.exit(2);
  }
}

const input = readStdinJson();
const root = projectRoot();

switch (input.hook_event_name) {
  case "PostToolUse":
    handlePostToolUse(input, root);
    break;
  case "Stop":
    handleStop(input, root);
    break;
  default:
    break;
}
```

### `scripts/ui-check.mjs` (UI_VERIFY fallback)

Adapt the login selectors (`#email`, `#password`, `button[type="submit"]`) and the credential variables.

```js
#!/usr/bin/env node
// Fallback for the Playwright MCP in the workflow's UI verification step.
// Usage: node scripts/ui-check.mjs --path /route [--path ...] [--email x]
// Credentials: UI_CHECK_EMAIL / UI_CHECK_PASSWORD from the environment or .env.local (a throwaway dev account).

import { chromium } from "playwright";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Next.js 16 dev mode breaks the login form's navigation on 127.0.0.1.
const WEB_URL = process.env.UI_CHECK_WEB_URL ?? "http://localhost:3000";
const SCREENSHOT_DIR = path.join(ROOT, ".playwright-mcp");

function parseArgs(argv) {
  const args = { paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (!["--path", "--email"].includes(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${arg} needs a value`);
    }
    i++;
    if (arg === "--path") args.paths.push(value);
    else args.email = value;
  }
  if (args.paths.length === 0) throw new Error("at least one --path is required");
  return args;
}

function readEnvFile(envPath) {
  const vars = {};
  if (!existsSync(envPath)) return vars;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) vars[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return vars;
}

function resolveCredentials(emailOverride) {
  const env = { ...readEnvFile(path.join(ROOT, ".env.local")), ...process.env };
  return {
    email: emailOverride ?? env.UI_CHECK_EMAIL,
    password: env.UI_CHECK_PASSWORD,
  };
}

async function login(page, credentials) {
  if (!credentials.email || !credentials.password) {
    throw new Error(
      "Missing credentials — set UI_CHECK_EMAIL and UI_CHECK_PASSWORD in .env.local, or pass --email.",
    );
  }

  await page.goto(`${WEB_URL}/login`);
  await page.fill("#email", credentials.email);
  await page.fill("#password", credentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 10_000,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const credentials = resolveCredentials(args.email);

  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`[console] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });

  const screenshots = [];

  try {
    await login(page, credentials);

    for (const routePath of args.paths) {
      await page.goto(`${WEB_URL}${routePath}`);
      // networkidle is discouraged for tests, but here it's what makes the
      // screenshot show loaded data rather than a loading state.
      await page.waitForLoadState("networkidle");

      const slug = routePath.replace(/^\/+/, "").replace(/\//g, "-") || "root";
      const screenshotPath = path.join(
        SCREENSHOT_DIR,
        `ui-check-${slug}.png`,
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      screenshots.push(screenshotPath);
    }
  } finally {
    await browser.close();
  }

  console.log("Screenshots:");
  for (const s of screenshots) console.log(`  ${path.relative(ROOT, s)}`);

  if (consoleErrors.length > 0) {
    console.log(`\nConsole errors: ${consoleErrors.length}`);
    for (const e of consoleErrors) console.log(`  ${e}`);
    process.exit(1);
  }

  console.log("\nConsole errors: none");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

---

## Decisions

Each outcome of the rework's grilling session, with its reason. Change a decision here first.

| # | Decision | Why |
|---|---|---|
| 1 | Issue tracker checked only when `gh` is available; skip with one line. No `.out-of-scope/` check — `wontfix` labels are the rejection record. Tracker config lives in `{AGENT_RULES}`. | `gh` wasn't installed and `.out-of-scope/` never existed, so both steps silently did nothing on every run; a second rejection store would drift. |
| 2 | Readiness block (open questions / assumptions / riskiest part) replaces percentage confidence. | In 69 runs no confidence score fell below 80%, and the risk dimensions were scored inverted relative to the "< 70% → pause" rule. Concrete questions are checkable; self-scores weren't. |
| 3 | Small-change lane after brainstorm (`SMALL_LANE_MAX`), agent proposes, user confirms. | A one-column change ran the same pipeline as a new module. The lane keeps triage, the decision gate, commits, both review axes and history. |
| 4 | UI / API / full-stack classified after brainstorm, from touched packages. | Keyword classification up front was wrong in at least 4 logged runs. |
| 5 | Husky pre-commit: any staged file under a package runs ESLint on its staged TS files (no fix) → typecheck → tests; docs-only commits skip. | Checks were prose the model could skip. Staged-only lint means pre-existing lint debt can't block unrelated commits. `lint:<pkg>` scripts are check-only because an app's `lint` script may `--fix`. Known limitation: checks run against the working tree, not a stash of the staged index, so a partially staged file is checked as it sits on disk — acceptable for an agent that stages whole files. |
| 6 | PostToolUse size hook warns, doesn't block; Stop hook blocks on typecheck/lint only, guarded by `stop_hook_active`. | Splitting a file is a judgement call. Tests are excluded from Stop because a red test is the intended state mid-TDD. |
| 7 | Inline fix loop, `FIX_ATTEMPTS` per task, then escalation. Contained-Mode fix only via escalation; file-size refactor keeps its resume prompt. | A type error right after writing code is the normal inner loop, not a sub-pipeline with a human gate. Structural splits deserve a check-in. |
| 8 | UI verification required for UI/full-stack: Playwright MCP (version-pinned) or the committed `ui-check` script. | "Visually confirm" had no mechanism; logged runs show live Playwright passes catching real bugs. `@latest` made the MCP time out on start. |
| 9 | Plans with ≥ `SUBAGENT_MIN` tasks: fresh sub-agent per task; it never commits or edits the plan. Tasks run sequentially unless the plan puts them in a parallel group (decision 14). | One context carried brainstorm through every task. Short plans stay inline because a cold start costs more than it saves. *(Revised: parallel worktrees were originally deferred because tasks usually depend on each other. Decision 14 keeps sequential as the default and allows parallel work only where the plan proves independence.)* |
| 10 | Per-task "Inner Monologue" removed; security/performance/DRY checked by the Standards reviewer via `REPO_REVIEW_CHECKLIST`. | Generic self-review restated per task added little; an independent reviewer with concrete, repo-specific items is checkable. |
| 11 | This spec is the complete portable template; project skills instantiate it and point back here. | Spec and skills had drifted, and the skills live in a gitignored folder — this tracked file is the versioned record and the thing to reuse in new projects. |
| 12 | History logs carry `Areas` (fixed vocabulary) and `Surfaces`; brain scan greps them. All existing logs backfilled. | Filename matching missed relevant history; without a backfill the grep would find nothing for months. |
| 13 | Unchanged: the A/B decision gate, the other human gates, two grilling passes in the full pipeline. | Not selected in the rework. |
| 14 | Opt-in **parallel groups**. The planner groups independent tasks with disjoint `Files:` lists. The coordinator runs each group as concurrent worktree sub-agents, commits per task in its worktree one at a time, cherry-picks in plan order, then runs a full-suite group gate. UI tasks may join a group only after the API contract has committed. Parallel sub-agents run unit specs only; symlinked `WORKTREE_LINKS` give them `node_modules` and env. | The meter-reading correction feature (7 tasks) ran fully sequentially, although its web tasks and its notification listener didn't depend on the neighbouring API tasks. Sequential stays the default because most chains are real. The rules cover each failure mode seen or foreseen: overlapping files (disjoint `Files:`, and a conflict drops back to sequential), a frontend built on an unshipped contract (rule 8), missing gitignored `node_modules` and env (links), integration specs on the shared DB (unit-only in parallel, commits one at a time), and changes that pass alone but not together (group gate). |
| 15 | **Handbook sync** step (feature 7c; fix 6b, refactor 5b, standalone only) runs after Verification, before code review, applying [[Developer Handbook]] §5 to the diff; skipped in Contained Mode; always run by the coordinator in-context, never a sub-agent. `REPO_REVIEW_CHECKLIST` gains a Docs judgement-call group as a backstop; history logs gain a `Handbook:` line. | [[Developer Handbook]] §5 named which note to update per kind of change, but no step executed it — the same gap that lets guides drift. Before code review, not after, so the Standards reviewer sees the doc edits. A dedicated docs pass over a diff the coordinator already holds doesn't benefit from a cold sub-agent the way an implementation task does. |
| 16 | The **Handbook sync** step edits a guide in place: a claim the change made untrue is rewritten so the guide states what is true now, in the present tense, with no strikethrough, dated "Corrected" marker or "added later" label. | The old rule wrote a `~~old~~ **Corrected (date) —**` marker on every change, so each guide became a history to replay. Git, the history notes and the specs already record what changed; a reversed decision leaves the guide and stays in its spec. |

| 17 | *fit_level_up port.* One package, so the per-package loops collapse to one set of commands; roles and seeded logins are replaced by a throwaway account; the integration-spec/shared-database constraint on parallel groups does not apply because every Vitest run owns its in-memory replica set; Claude Design hand-off (Step 3.5) is replaced by the design-quality critique alone; lint runs on changed files because the repo carries pre-existing lint errors. | The structure is kept identical so the skills stay portable; only adapter values and the places that named apartment-system packages changed. |

---

## Required Skills

Must exist in `.claude/skills/` (or global config):

- `workflow`, `feature`, `fix`, `refactor`, `code-review` — generated from this spec.
- `brainstorming`, `grilling`, `tdd`, `diagnosing-bugs`, `to-spec`, `request-refactor-plan`, `obsidian-vault`.
- UI: `design-taste-frontend`, `emil-design-eng`, `ui-ux-pro-max`, `ui-styling`, `pick-ui-library`, `ask-sonner`, `review-animations`; conditional `apple-design`, `animation-vocabulary`.

---

## Porting Guide

1. Copy the skills listed above into `.claude/skills/`.
2. Fill in the **Project Adapter** (paths, packages, check commands, seed logins, area vocabulary, review checklist, reuse lists).
3. Generate `workflow`, `feature`, `fix`, `refactor` and `code-review` from the pipeline sections, substituting adapter values. Add the header line: `Instantiated from <path to this spec> — structural changes (steps, gates, formats) go there first.`
4. Add the intent-gate rule (Entry Points) to the project's agent rules file.
5. Install enforcement: Husky + `prepare`, check-only lint, `typecheck` and `test:run` scripts, the three hook files, and `playwright` if UI verification is needed. Verify each hook branch by hand (staged type error, staged lint error, docs-only commit, oversized file, `stop_hook_active`).
6. Pin the Playwright MCP version.
7. Create `{SPEC_DIR}`, `{PLAN_DIR}`, `{HISTORY_DIR}` and their index notes.
8. Clear existing lint debt so the hooks start from zero.

[[Specs Index]]
