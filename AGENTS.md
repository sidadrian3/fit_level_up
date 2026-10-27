## Agent skills

### Issue tracker

GitHub Issues (with PRs as request surface disabled). Repo: `sidadrian3/fit_level_up`.

### Triage labels

Default vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`).

### Domain docs

Single-context layout (Obsidian vault at `vault/`). See `CONTEXT.md` for the entry point.
**Design Specs & Plans**: Save all new specs and plans directly into `vault/specs/` and `vault/plans/` using Title Case without date prefixes (e.g. `My Feature Design Spec.md`, `My Feature Plan.md`). Keep the vault flat — use `[[wikilinks]]` and index notes for navigation instead of deep folders. Append a backlink to the relevant index note (e.g. `[[Plans Index]]` or `[[Specs Index]]`) at the bottom of the file. Do not write specs or plans to `docs/` — that folder no longer exists.

---

## Repo Layout

Single Next.js 16 (App Router) package — no workspaces.

```
src/
  app/            # pages ((app), (auth), (landing) route groups) and api/ route handlers
  components/     # React components by feature; components/ui/ holds the shared primitives
  server/         # everything that runs only on the server ("server-only")
    runtime.ts    # composition root: the wired defineRoute, the outbox dispatcher, the listener list
    platform/     # infrastructure: config, env, domain, auth/, database/, events/, http/
    progression/  quests/  training/  achievements/  social/  notification/   # feature modules
  shared/         # isomorphic code: contracts/ (Zod schemas and wire types), time/, static definitions
  lib/            # browser side only: <domain>/{api,keys,hooks}, auth/client.ts, shared/api-fetch.ts, utils/, constants/, hooks/
  testing/        # test helpers (seedPlayer, transactions)
  scripts/        # DB migration runner, numbered migrations, outbox operator tool
  proxy.ts        # route protection (Next.js middleware)
tests/e2e/        # Playwright
vault/            # Obsidian second brain — see CONTEXT.md
```

Run `npm install`, then `npm run dev`. Unit and integration tests run with `npm run test:run` against an in-memory MongoDB replica set (no local database needed).

---

## Styling

- Use **Tailwind CSS v4** for all styling — utility classes only, no vanilla CSS files (except `globals.css` for the Tailwind import and `@theme` design tokens).
- Never use inline `style={{}}` props. Map design decisions to Tailwind utilities or the tokens defined in `globals.css`.
- Keep component class strings readable — extract long class lists into a small helper (e.g. `clsx` + `tailwind-merge`) rather than inlining them.
- **Reuse `src/components/ui/` first** (`Button`, `Card`, `Badge`, `StatCard`, `ProgressBar`, `EmptyState`, `Pagination`, `UserAvatar`). Only build a new primitive when none fits, and put it there.
- Follow the "Modern Athletic" design direction recorded in [[UI Overhaul Design Spec]] — consistent tokens, spring-physics interactions, no generic glass panels.

---

## File Architecture

### Back-end layers

Every feature flows through the same layers. Read [[Domain Architecture]] before adding a feature.

| Layer | Location | Does | Never does |
|---|---|---|---|
| Controller: API route | `src/app/api/**/route.ts` | Declare the contract to `defineRoute` (`auth`, `throttle`, Zod `body`/`query`/`params`, `idempotency`), call a service, shape the response | Business logic, repository calls, hand-written auth, parsing or `try/catch` |
| Controller: event listener | `src/server/<module>/<noun>.listeners.ts` | React to an outbox event by calling a service | Business logic, repository calls |
| Service | `src/server/<module>/**/<noun>.service.ts` | Orchestrate a sub-feature's use cases: load state → call rules → persist (in a transaction when several writes must agree) → `emit` events | Math that belongs in a rule |
| Rules | `src/server/<module>/**/<noun>.rules.ts` | Pure functions: XP, stamina, streaks, quest, achievement and friendship rules | I/O, Mongo, `Date.now()` hidden inside rules, importing a repository |
| Repository | `src/server/<module>/**/<noun>.repository.ts` | One MongoDB collection's reads and writes, mapping documents to domain types | Business decisions, calling other modules |

- Every file in a feature module (`achievements`, `notification`, `progression`, `quests`, `social`, `training`) is `index.ts` or `<noun>.<role>.ts`. The roles are `service`, `repository`, `rules`, `definitions`, `events`, `listeners` and `adapters`. The noun is what the file works on (`social/` files use `friendship`). `index.ts` is the module's public surface; other modules and `src/app` import only from it.
- A `<noun>.service.ts` holds all of a sub-feature's use cases. Steps shared by several use cases are private functions in the same file; export only what `index.ts` re-exports. Training keeps one sub-folder per sub-feature (`workouts/`, `runs/`, `templates/`, `exercises/`, `stats/`).
- Controllers (routes and listeners) may call services from several modules and hand one module's function to another; the dashboard route does this to keep `training` from importing `achievements`. They never contain business rules. Pages call read services only; every write goes through an API route.
- `src/server/platform/` is infrastructure, one file per concern or a folder when a concern has several distinct parts: `config`, `env`, `domain`, `auth/`, `database/`, `events/`, `http/`.
- A service that touches more than one collection uses `client.startSession()` + `session.withTransaction(...)` and passes the `session` into every repository call (see `logWorkout`).
- Services are plain exported functions, not classes. `src/server/progression` owns every game-state transition (XP, level, streak, stamina, totals) through `recordActivity` and `grantXp`, so those rules cannot be applied twice or differently; no other code reads or writes `player_profiles`.
- `src/lib` is browser-only. Dependency-cruiser enforces the boundaries as part of `npm run lint`: no cycles, `src/shared` imports nothing app-side, UI code reaches `src/server` for types only, `platform` imports no feature module, only `runtime.ts` wires `achievements` and `notification`, and only `src/app` imports `runtime.ts`.

### Front-end structure (Next.js App Router)

- Pages are thin — they compose components, call hooks, and handle loading/error boundaries (`loading.tsx`, `error.tsx` sit next to the page).
- A component used by one page lives in that page's private `_components/` folder (`app/(app)/<page>/_components/`). A component rendered on several pages, or by the app shell, lives in `src/components/shared/<area>/`. `components/ui/` holds the shared primitives. UI code reaches `src/server` for types only.
- Browser-side data access lives in `src/lib/<domain>/`: endpoint wrappers in `api.ts`, query keys in `keys.ts`, TanStack Query hooks in `hooks/`. Components import those hooks only and never call `fetch()` directly.
- Shared cross-feature code lives under `src/lib/utils/`, `src/lib/hooks/`, `src/lib/constants/`.

---

## Coding Standards

### Test-Driven Development (TDD)

- Write the failing test first, then implement the minimum code to pass it.
- **Integration tests first.** Cover each use case end to end through its service against the in-memory MongoDB replica set (see `src/server/training/workouts/__tests__/log-workout.test.ts`): at least the happy path and one error path per use case. Route handlers with real branching get a route test (see `src/app/api/workouts/__tests__/route.test.ts`).
- **Unit tests only for real branching logic** — XP and stamina formulas, streak and quest rules, boundary checks. These sit in the module's `__tests__/` folder next to the `*.rules.ts` file they cover. Pass-through routes, simple queries and mapping functions get no unit test of their own; the integration test covers them.
- Create a test file only when it holds a test the rules above call for.
- Do not mark a task complete until all relevant tests pass. `npm run test:run` is the one-shot command (`npm test` starts watch mode).

### No God Classes

- A module must have a single, clearly stated responsibility.
- A file passing ~400 lines is a prompt to check that it still has one responsibility. Split it only if it has two. A long service that reads top to bottom is easier to follow than several short files that must be read together.
- Prefer one focused unit that owns a whole use case over many tiny single-caller files. Split by responsibility, not by function.

### Abstraction First

- Extract shared logic into dedicated utilities, hooks, or services before duplicating.
- **Extract at the second real caller.** Logic with one caller stays a private function in the file that uses it — no one-function util files. A flow should be traceable by opening a handful of files, not a dozen.
- Name abstractions by what they _do_, not how they _work_.

### SOLID, scaled to this codebase

- **Single Responsibility** — a function, hook, or component changes for one reason only. A service that validates input, runs game math, writes to Mongo and formats a response is four things; the layers above exist to prevent that.
- **Open/Closed** — extend behaviour by adding data or a new handler, not by growing an `if/switch` chain. Quest metrics, achievement conditions and exercise definitions are tables, not branches. Apply this once a second variant exists; add no extension points for variants nobody has asked for.
- **Dependency Inversion** — domain rules take their inputs as arguments; they never reach for the database or the clock. Services receive the `session` rather than opening their own when they run inside a transaction.
- Don't force a named pattern where a plain function suffices.

### Event-Driven Patterns

- Cross-module reactions go through the transactional outbox (`src/server/platform/events/`), not by one service importing another. A service calls `emit(...)` inside its transaction; a `<noun>.listeners.ts` in the reacting module handles it. A module declares its event types in `<noun>.events.ts`.
- `defineRoute` dispatches the events a request emitted after the response (`after()`), so a slow or failing listener never fails the user's request.

### DRY — No Duplicate Boilerplate

- Extraction timing follows *Abstraction First*: extract at the second real caller.
- Share request validation, error mapping and response shaping through `defineRoute`, `toErrorResponse` and the Zod schemas in `src/shared/contracts/` — never copy-paste them.

### Shared Type Definitions

- A type used by one file stays in that file.
- A type shared across files lives in `src/shared/contracts/<domain>.ts`, next to the Zod schemas it is inferred from.
- Database document types (`*Doc`) live in `src/server/platform/database/schema.ts`, next to the collection and index definitions.

### No Deprecated APIs

- Never use deprecated methods, properties, or APIs — always use the current recommended alternative.
- If a dependency upgrade introduces deprecations, resolve them before marking the task done.

### Self-Documenting Code

- Code must be understandable by reading it — not by reading comments about it. If a reviewer needs a comment to know what a block does, rewrite the block.
- Reach for clarity through descriptive names (`isStreakBroken`, not `check`), small single-purpose functions, early returns over nested conditionals, and types that make invalid states unrepresentable.
- Comments are for the _why_ only — a non-obvious constraint, a workaround for a specific bug, a trade-off a future reader would otherwise re-litigate. One short line. Never restate what the next line says.
- Never leave commented-out code in the codebase — delete it; git history is the record.

### No `any`

- Never use `any` in TypeScript. Use `unknown`, a proper type, or a generic instead.
- If a third-party type is missing, extend or wrap it — do not cast to `any`.

### Request Validation

- Every route that accepts a body or query input validates it with a **Zod schema** from `src/shared/contracts/` before it reaches a service. `defineRoute` runs it when the route declares `body`, `query` or `params`. Never pass an unvalidated `request.json()` onward.
- Validation failures surface as `400` through `toErrorResponse` (which maps `ZodError`); never hand-roll that response.
- Clamp pagination inputs (`limit` has a hard maximum, `page` is a positive integer); never trust raw `parseInt` output.

### Centralized API Error Handling

- Never format error responses by hand in a route. Throw an `AppError` subclass from `src/server/platform/http/errors.ts` (`BadRequestError`, `UnauthorizedError`, `NotFoundError`, `ConflictError`, …) and let `defineRoute` turn it into JSON through `toErrorResponse`.
- Anything that is not an `AppError` or `ZodError` becomes a logged `500` — never leak internals in the message.

### MongoDB & Data Integrity

- **Every query is scoped by `userId`.** A route takes `userId` from the session through `defineRoute` (`auth: "user"`), never from the request body, query string or URL for ownership decisions. Fetching, updating or deleting by `_id` alone is an IDOR bug — add `userId` to the filter.
- **Idempotent creates.** A create that a retry could repeat (workouts, runs, templates) is declared `idempotency: "required"` on its route, so the client sends an `Idempotency-Key` header, and the service wraps the insert in `createOnce` (`src/server/platform/http/idempotency.ts`), backed by a unique index in `schema.ts`. A retry returns the existing entity.
- **Atomic read-modify-write.** Use `$inc`/`$set` updates, `bulkWrite` upserts or a transaction. Never read a document, change it in JS and write it back across an `await` — that is a lost-update race (see the quest-sync TOCTOU fix).
- **Indexes.** A new query shape gets an index in `src/server/platform/database/schema.ts` in the same change.
- **Collections** are named in `COLLECTIONS` (`schema.ts`) and reached through a repository; never hardcode a collection string in a service.

### Domain Data Extraction

- Never hardcode domain constants (XP rates, level formulas, stamina costs, quest or achievement thresholds, exercise lists) inside React components or services.
- Game tuning lives in `src/server/platform/config.ts`; static lists live in `src/shared/` (definitions the server also needs) or `src/lib/constants/` (browser-only). Type them `as const` and export them for reuse.

### React Query & API Types

- **Shared Fetch Helper.** Never write raw `fetch()` in a hook or component. Browser calls go through `apiFetch` (`src/lib/shared/api-fetch.ts`), which owns the error shape and the retry of idempotent requests on network failure. Add an endpoint wrapper in `src/lib/<domain>/api.ts`.
- **Cross-feature cache invalidation.** A mutation that changes state shown elsewhere (logging a workout moves XP, quests and personal records, which are client queries, and achievements and the dashboard, which are server-rendered) must invalidate every affected query key, not only its own. The mutation hook owns the invalidation, using the `keys.ts` tables of the domains it touches (and `invalidateActivityChange` for workout and run changes).
- **Hooks only in the UI.** Pages and components never import `@tanstack/react-query` (ESLint enforces it); they use a hook from `src/lib/<domain>/hooks`. Query keys come from the domain's `keys.ts` table, never string literals.
- **Stable idempotency keys.** Generate a form's `idempotencyKey` once when the form mounts (`useState`), so a retried submit is recognised as the same request.
- **Explicit generics** on mutations and `apiFetch<T>` calls — never let the response type fall back to `unknown`.

### Testing & Mocks

- Services are tested against the real in-memory replica set from `vitest.global-setup.ts`, not against mocked repositories. A mock that lets a test pass without exercising Mongo semantics (transactions, unique indexes, `$inc`) hides exactly the bugs this layer exists to prevent.
- Mock only true external boundaries (Upstash Redis, the clock when a test needs it).
- `fileParallelism` is off because tests share one replica set; clean up the data your test created.

### Routing & URL Management

- Coarse-grained route protection lives in `src/proxy.ts` (`protectedRoutes`, `publicAuthRoutes`). When you add an authenticated page, add its prefix there and its link to `src/lib/constants/navigation.ts`.
- API routes are not covered by the proxy matcher — every API route declares `auth` to `defineRoute`, which authenticates it.

### Next.js Build Cache & Typechecking

- **Stale Type Definitions**: If `npm run typecheck` fails with `Cannot find module` errors originating from inside `.next/types/`, it is likely a stale build cache issue caused by deleted or renamed files. Do not chase ghost errors; clear the cache (`rm -rf .next`) before assuming it is a real code issue.

### Next.js 16 Rules

This is not the Next.js of your training data (`proxy.ts` replaces `middleware.ts`, async request APIs, and more). Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.

---

## Agentic Workflows & Review

When operating as an AI agent (before writing any plan or spec), you MUST follow these specific thought processes:

### 1. Chain of Thought (CoT)

Before proposing any complex solution, you must initialize a `### Thought Process` section. Within this, identify:

- **The core technical challenge.**
- **Potential edge cases** (e.g., race conditions, retries, double submits, null pointers).
- **Impact on existing system architecture.**

### 2. Red-Team Review

Every change is reviewed for:

- **Inefficiencies** (e.g., N+1 queries, unbounded lists, O(n²) over growing collections).
- **Security vulnerabilities** (OWASP Top 10 — in this codebase especially unauthenticated routes, queries not scoped by `userId`, unvalidated input, missing rate limits on mutations).
- **Violation of DRY** (Don't Repeat Yourself) principles.

These are checked by an independent reviewer — the Standards axis of the `code-review` skill, which carries the concrete repo checklist — not by an inline self-review pass while coding.

### 3. Context-Aware Depth

You have a large context window. Use it. Always cross-reference the current task with related modules, interfaces, and previously generated artifacts to ensure semantic consistency.

### 4. Proactive Inquiry

If a task is ambiguous, do not guess. Provide two possible interpretations and ask for clarification before executing.

### 5. Performance-First Mindset

When writing logic, prioritize memory efficiency and non-blocking operations. Explain any trade-offs made between readability and performance. The `code-review` Standards axis checks the concrete performance items (see §2).

---

## Workflow Intent Detection

When the user sends a message that contains strong-signal work language, show the intent gate before taking any action.

**Strong signals (trigger the gate):**

- Action verbs: `let's`, `build`, `add`, `implement`, `create`, `fix`, `refactor`, `clean up`, `extract`
- Bug language: `broken`, `crash`, `error`, `not working`, `failing`

**Gate format (output exactly one line, no emojis):**

```
Detected: [feature / bug / refactor] — "[one-line summary of the request]"
Start workflow? [yes / no / just talking]
```

- `yes` → invoke the `workflow` skill
- `no` → treat as normal conversation
- `just talking` → treat as normal conversation; do not offer the gate again this session

**Do NOT intercept messages that:**

- Start with: `what if`, `I think`, `should we`, `could we`, `I noticed`
- End with `?` (questions)
- Are replies within an already-active brainstorming or planning conversation
- Are slash commands (`/feature`, `/fix`, `/refactor`) — slash commands bypass the gate and invoke the workflow skill directly
