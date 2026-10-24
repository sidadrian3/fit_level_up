# Idempotency Key Header Implementation Plan

> **For agentic workers:** this plan is executed by the `feature` pipeline (Step 7): one fresh sub-agent per task, in order. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create routes take a UUID `Idempotency-Key` header, replay a same-body retry as `201` + `Idempotent-Replayed: true`, reject a changed body with `422`, and `apiFetch` retries only requests that carry the header.

**Architecture:** `defineRoute` gains an `idempotency: "required"` option that validates the header and fingerprints the Zod-validated body. A shared `createOnce` helper in `platform/http` does check, then create, then a recheck on a duplicate key, for the three create services. The client sends the key as a header through an `apiFetch` option, and a `useIdempotencyKey` hook holds one key per form mount.

**Tech Stack:** Next.js 16 route handlers, Zod 4, MongoDB (in-memory replica set in tests), Vitest, TanStack Query.

**Spec:** [[Idempotency Key Header Design Spec]]

## Global Constraints

- Header name `Idempotency-Key`; value parsed with `z.uuid()`. Missing or invalid → `400 { error: "Missing or invalid Idempotency-Key header" }`.
- Replay → status **201** with header `Idempotent-Replayed: true`. A new create → 201 with no such header.
- Fingerprint = SHA-256 **hex** of `JSON.stringify(validatedBody)`; stored as `idempotencyFingerprint`.
- Replay only when the stored fingerprint **equals** the request's; anything else (including no stored fingerprint) → `422` `IdempotencyKeyReusedError`.
- 422 messages, verbatim:
  - workout: `This workout was already saved with your earlier details. Check your history to edit it, or submit again to log a new one.`
  - run: `This run was already saved with your earlier details. Check your history to edit it, or submit again to log a new one.`
  - template: `This template was already saved with your earlier details. Submit again to save a new one.`
- `idempotency` is allowed only on `auth: "user"` POST routes.
- `apiFetch` retries a `TypeError` only when the method is absent/GET/HEAD or the request carries `Idempotency-Key`.
- AGENTS.md rules apply: no `any`, Tailwind only, no raw `fetch()` outside `apiFetch`, services tested against the replica set (no `-db.ts` mocks), clean up test data.
- Commit messages carry no `Co-Authored-By` trailer.

## Review Focus

- **A replay after the person edited the entity** (create → PUT changes the title → the old create is retried) should replay the *current* entity, not revert it or 422. The update path uses `$set`, so key and fingerprint survive. Pinned in Task 3 (`log-workout.test.ts`).
- **Header name case** (`idempotency-key`) must be accepted: `Headers` are case-insensitive, but a hand-rolled lookup could break it. Pinned in Task 2.
- **Field order in the body** must not change the fingerprint. Pinned in Task 2.
- **A replay must not apply XP, stamina or quest progress twice.** Pinned in Task 3 for workouts and runs.
- **Edit mode must never send the header** or use the key: a PUT carrying it would become retryable again. Pinned in Task 4 (`api-fetch.test.ts` asserts a PUT without the option isn't retried; `updateWorkout`/`updateRun` take no key).

---

### Task 1: `createOnce` and the 422 error (layer: platform)

**Files:**
- Create: `src/server/platform/http/idempotency.ts`
- Modify: `src/server/platform/http/errors.ts` (add `IdempotencyKeyReusedError`)
- Modify: `src/server/platform/http/index.ts` (export the new symbols)
- Test: `src/server/platform/http/__tests__/idempotency.test.ts`

**Builds on:** `AppError` and `toErrorResponse` (`errors.ts`), `isDuplicateKeyError` (`@/server/platform/database`).

**Interfaces:**
- Consumes: `isDuplicateKeyError(error: unknown, field: string): boolean`.
- Produces:
  ```ts
  export interface IdempotencyRequest { key: string; fingerprint: string }
  export interface IdempotentResult<T> { value: T; replayed: boolean }
  export interface IdempotentRecord<T> { value: T; fingerprint: string | undefined }
  export function createOnce<T>(options: {
    request: IdempotencyRequest;
    findExisting: () => Promise<IdempotentRecord<T> | null>;
    create: () => Promise<T>;
    reusedMessage: string;
  }): Promise<IdempotentResult<T>>;
  export class IdempotencyKeyReusedError extends AppError {} // statusCode 422, constructor(message: string)
  ```

- [ ] **Step 1: Write the failing tests** in `idempotency.test.ts`, against the replica set. Use a throwaway collection (`idempotency_test`) given the unique partial index `{ userId: 1, idempotencyKey: 1 }` in `beforeAll`, and drop it in `afterAll`. `create` inserts `{ userId, idempotencyKey, idempotencyFingerprint, n }`, and `findExisting` maps the found doc to `{ value: doc.n, fingerprint: doc.idempotencyFingerprint }`.
  - `creates when the key is new` → `{ value: 1, replayed: false }`, one document.
  - `replays when the key and fingerprint match` → the second call returns `{ value: 1, replayed: true }`, and `create` is not called (spy).
  - `throws IdempotencyKeyReusedError when the fingerprint differs` → rejects with that class, `statusCode === 422`, message equals `reusedMessage`.
  - `throws when the stored document has no fingerprint` → seed a doc without `idempotencyFingerprint` → rejects with `IdempotencyKeyReusedError`.
  - `resolves two racing calls to one document` → `Promise.all` of two calls with the same request → exactly one `replayed: false`, one `replayed: true`, `countDocuments === 1`.
  - `rethrows a non-duplicate error from create` → `create` throws `new Error("boom")` → rejects with `"boom"`.
- [ ] **Step 2: Run and see it fail** with `npx vitest run src/server/platform/http/__tests__/idempotency.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement.** `createOnce`: `findExisting` → equal fingerprint returns a replay, otherwise throw. Else `create` → `{ value, replayed: false }`. If `create` throws `isDuplicateKeyError(err, "idempotencyKey")`, run the same find-and-compare once more; if it still finds nothing, rethrow the original error. `IdempotencyKeyReusedError` mirrors `ConflictError` with status 422; `toErrorResponse` needs no change (it maps any `AppError`).
- [ ] **Step 4: Run and see it pass.** Same command. Expected: 6 passed.
- [ ] **Step 5: Commit**
  ```bash
  git add src/server/platform/http/idempotency.ts src/server/platform/http/errors.ts src/server/platform/http/index.ts src/server/platform/http/__tests__/idempotency.test.ts
  git commit -m "feat(http): add createOnce and IdempotencyKeyReusedError"
  ```

---

### Task 2: `defineRoute` idempotency option, with body fallback (layer: route platform)

**Files:**
- Modify: `src/server/platform/http/define-route.ts`
- Modify: `src/app/api/__tests__/route-table.test.ts`
- Test: `src/server/platform/http/__tests__/define-route.test.ts`

**Builds on:** Task 1 types; the existing pipeline in `createDefineRoute`.

**Interfaces:**
- Consumes: `IdempotencyRequest`, `IdempotentResult<T>` from `./idempotency`.
- Produces:
  - `RouteOptions` gains `idempotency?: "required"`.
  - Handlers of routes with `idempotency: "required"` receive `ctx.idempotency: IdempotencyRequest` and must return `Promise<IdempotentResult<T>>`. Every other route gets `ctx.idempotency: undefined` and is typed exactly as today.
  - Implement this as **two overloads** of `defineRoute`, one for `{ idempotency: "required" }` options and one for the rest. Don't use a conditional return type: the overloads leave the inference of the existing ~25 routes untouched. `DefinedRoute.definition` keeps the widened `RouteOptions` with `idempotency`.

- [ ] **Step 1: Write the failing tests** in a new `describe("idempotency")` block in `define-route.test.ts`. Add a helper `idempotentPost(body: string, key?: string)` that sets `Idempotency-Key` when `key` is given. Use a route `{ name: "t", auth: "user", throttle: "standard", body: z.object({ a: z.number(), b: z.string(), idempotencyKey: z.uuid().optional() }), idempotency: "required", status: 201 }`.
  - `returns 400 without the header` → status 400, body `{ error: "Missing or invalid Idempotency-Key header" }`, handler not called.
  - `returns 400 for a non-UUID header` → `"abc"` → 400.
  - `accepts a lowercase header name` → the header set as `idempotency-key` reaches the handler with that key.
  - `falls back to body.idempotencyKey when the header is absent` → the handler receives `idempotency.key` equal to the body's key. *(Removed in Task 5.)*
  - `passes a sha256 hex fingerprint of the validated body` → `ctx.idempotency.fingerprint` matches `/^[0-9a-f]{64}$/` and equals `createHash("sha256").update(JSON.stringify({ a: 1, b: "x" })).digest("hex")`.
  - `fingerprints equal bodies equally regardless of field order` → `{"b":"x","a":1}` and `{"a":1,"b":"x"}` give the same fingerprint.
  - `adds Idempotent-Replayed on a replay` → handler returns `{ value: { id: 1 }, replayed: true }` → status 201, header `Idempotent-Replayed: "true"`, JSON `{ id: 1 }`.
  - `omits the header on a new create` → `replayed: false` → 201, `headers.get("Idempotent-Replayed") === null`.
  - `leaves non-idempotent routes untouched` → a route without the option and without the header returns its plain value with status 200.
- [ ] **Step 2: Add the route-table rule.** In `route-table.test.ts`, inside the first test's loop, push the violation `${label}: idempotency is only allowed on user POST routes` when `definition.idempotency !== undefined && !(definition.auth === "user" && method === "POST")`. This passes today (no route uses it); it guards Task 3.
- [ ] **Step 3: Run and see it fail** with `npx vitest run src/server/platform/http/__tests__/define-route.test.ts`. Expected: the new idempotency cases fail.
- [ ] **Step 4: Implement** in `createDefineRoute`. After the body parse (fallback phase): if `options.idempotency === "required"`, read the key from `request.headers.get("Idempotency-Key")`, or else from the parsed body's `idempotencyKey`. Parse it with `z.uuid()`; on failure throw `BadRequestError("Missing or invalid Idempotency-Key header")`. Fingerprint the parsed body with the existing `createHash` import (`.digest("hex")`). After the handler, an idempotent route turns `{ value, replayed }` into `NextResponse.json(value, { status: options.status ?? 200, headers: replayed ? { "Idempotent-Replayed": "true" } : undefined })`. Add a one-line comment that the body fallback is transitional and is removed in this PR's last commit.
- [ ] **Step 5: Run and see it pass.** `npx vitest run src/server/platform/http/__tests__/define-route.test.ts src/app/api/__tests__/route-table.test.ts` passes, and `npm run typecheck` is clean (all existing routes still type-check).
- [ ] **Step 6: Commit**
  ```bash
  git add src/server/platform/http/define-route.ts src/server/platform/http/__tests__/define-route.test.ts src/app/api/__tests__/route-table.test.ts
  git commit -m "feat(http): read Idempotency-Key and fingerprint the body in defineRoute"
  ```

---

### Task 3: Create services and routes replay through `createOnce` (layers: data → service → route)

**Files:**
- Modify: `src/server/platform/database/schema.ts`: `WorkoutDoc`, `RunDoc` and `WorkoutTemplateDoc` gain `idempotencyFingerprint?: string`, and the `workouts`, `runs` and `workoutTemplates` validators gain `idempotencyFingerprint: string` in `properties` (not `required`).
- Modify: `src/lib/data/workout-db.ts`, `src/lib/data/runs-db.ts`, `src/lib/data/workout-templates-db.ts`: the three by-key lookups return `IdempotentRecord<…> | null`.
- Modify: `src/lib/services/workouts/log-workout.ts`, `src/lib/services/runs/log-run.ts`, `src/lib/services/workout-templates/create-workout-template.ts`
- Modify: `src/app/api/workouts/route.ts`, `src/app/api/runs/route.ts`, `src/app/api/workout-templates/route.ts`
- Modify: `src/shared/contracts/workout.ts`, `run.ts`, `template.ts`: `idempotencyKey` becomes `.optional()`.
- Modify: `src/lib/types.ts`: `idempotencyKey?: string` on `CreateWorkoutInput`, `CreateRunInput`, `CreateWorkoutTemplateInput`.
- Test: `src/lib/services/__tests__/log-workout.test.ts`, `create-workout-template.test.ts`, new `log-run.test.ts`; `src/app/api/workouts/__tests__/route.test.ts`, `src/app/api/runs/__tests__/route.test.ts`, `src/app/api/workout-templates/__tests__/route.test.ts`; `src/lib/data/__tests__/workout-templates-db.test.ts` (adjust to the lookup's new return shape).

**Builds on:** Task 1 `createOnce`, Task 2 `ctx.idempotency`. Seed users the way `log-workout.test.ts` does (`getCollection<UserDoc>("user").insertOne(...)`).

**Interfaces:**
- Consumes: `createOnce`, `IdempotencyRequest`, `IdempotentResult`, `IdempotentRecord` (Task 1); `defineRoute({ idempotency: "required" })` (Task 2).
- Produces:
  ```ts
  logWorkout(input: CreateWorkoutInput, userId: string, idempotency: IdempotencyRequest): Promise<IdempotentResult<Workout>>
  logRun(input: CreateRunInput, userId: string, idempotency: IdempotencyRequest): Promise<IdempotentResult<Run>>
  createWorkoutTemplate(input: z.infer<typeof WorkoutTemplateSchema>, userId: string, idempotency: IdempotencyRequest): Promise<IdempotentResult<WorkoutTemplate>>
  getWorkoutByIdempotencyKey(userId: string, key: string): Promise<IdempotentRecord<Workout> | null>
  getRunByIdempotencyKey(userId: string, key: string): Promise<IdempotentRecord<Run> | null>
  getWorkoutTemplateByIdempotencyKeyFromDb(userId: string, key: string): Promise<IdempotentRecord<WorkoutTemplate> | null>
  ```
  The HTTP contract: POST `/api/workouts`, `/api/runs` and `/api/workout-templates` require the header (body fallback until Task 5), and return 201, 201 + `Idempotent-Replayed`, or 422.

- [ ] **Step 1: Write the failing service tests.** Each test calls the service with `{ key: crypto.randomUUID(), fingerprint: "f1" }`.
  - `log-workout.test.ts`: update the existing duplicate test to expect `{ replayed: true }` on the second call, with one workout document and the user's `xp` and `totalWorkouts` incremented once. Add:
    - `stores the fingerprint on the workout`.
    - `rejects the same key with a different fingerprint with 422 and changes nothing`: `IdempotencyKeyReusedError`, the workout message from Global Constraints, user `xp` unchanged.
    - `replays the edited workout after an update`: log, `updateWorkout` the title, log again with the same request → `replayed: true` with the new title.
  - New `log-run.test.ts`: happy path (`replayed: false`, user `totalDistance` increments), replay (`replayed: true`, one run, distance counted once), mismatch (422, run message).
  - `create-workout-template.test.ts`: update the existing retry and race tests to the `IdempotentResult` shape. Add a mismatch test (422, template message).
- [ ] **Step 2: Write the failing route tests.** Extend `src/app/api/workouts/__tests__/route.test.ts` and the runs equivalent. Seed a user, point `vi.mocked(getAuthUserId)` at its id, have `limit` resolve to success, and use a valid body:
  - `returns 400 without an Idempotency-Key header`.
  - `replays a retry with Idempotent-Replayed`: two POSTs with the same header and body → 201 then 201 with the header `"true"` and the same `id`.
  - `returns 422 when the key is reused with a different body`.

  Templates (`workout-templates/__tests__/route.test.ts`) get the same three cases; no user seed is needed. Keep the existing rate-limit tests: their empty-body requests still return 400, now from the missing header or from Zod.
- [ ] **Step 3: Run and see them fail** with `npx vitest run src/lib/services/__tests__ src/app/api`. Expected: the new cases fail.
- [ ] **Step 4: Implement data.** Add `idempotencyFingerprint` to the doc types and validators. Each lookup maps the doc to `{ value: toX(doc), fingerprint: doc.idempotencyFingerprint }`. Inserts pass the field through unchanged (they spread the doc).
- [ ] **Step 5: Implement services.** Each service calls `createOnce({ request: idempotency, findExisting: () => getXByIdempotencyKey(userId, idempotency.key), create, reusedMessage })`.
  - `create` is the existing write. For workouts and runs that's the `startSession` + `withTransaction` block, ending the session in `finally`, and the insert stores `idempotencyKey: idempotency.key, idempotencyFingerprint: idempotency.fingerprint`.
  - Delete the old catch-duplicate / `ConflictError("…already logged")` branches.
  - Schedule `after(evaluateAchievements…)` only when `!result.replayed`.
  - Services no longer read `input.idempotencyKey`.
- [ ] **Step 6: Implement routes.** Add `idempotency: "required"` to the three POST definitions and pass `idempotency` through, e.g. `({ userId, body, idempotency }) => logWorkout(body, userId, idempotency)`. Make the contract and input-type key optional.
- [ ] **Step 7: Run and see them pass.** `npx vitest run src/lib/services/__tests__ src/lib/data/__tests__ src/app/api src/server` passes, and `npm run typecheck` is clean.
- [ ] **Step 8: Commit**
  ```bash
  git add src/server/platform/database/schema.ts src/lib/data src/lib/services src/app/api src/shared/contracts src/lib/types.ts
  git commit -m "feat(training): replay create retries through createOnce with Idempotent-Replayed"
  ```

---

### Task 4: Client sends the header; forms own one key per mount (layers: client data, hook, component)

**Files:**
- Modify: `src/lib/data/api-client/api-fetch.ts` (`ApiError`, `idempotencyKey` option, retry rule)
- Modify: `src/lib/data/api-client/workouts.ts`, `runs.ts`, `workout-templates.ts`
- Modify: `src/lib/data/api-client/index.ts` (export `ApiError`)
- Create: `src/lib/hooks/useIdempotencyKey.ts`
- Modify: `src/lib/hooks/useEntityForm.ts`
- Modify: `src/components/workouts/WorkoutForm.tsx`, `src/components/runs/RunForm.tsx`, `src/components/workouts/CreateTemplateForm.tsx`
- Test: `src/lib/data/api-client/__tests__/api-fetch.test.ts` (new; `vi.stubGlobal("fetch", …)`, fake timers for the 1 s retry delay)

**Builds on:** `apiFetch`, `useEntityForm`, the pages' existing refresh callbacks (`handleEditComplete` in `workouts/page.tsx` and `runs/page.tsx`).

**Interfaces:**
- Consumes: the HTTP contract from Task 3 (header, 201/422).
- Produces:
  ```ts
  export class ApiError extends Error { constructor(public status: number, message: string) }
  export async function apiFetch<T>(url: string, options?: RequestInit & { idempotencyKey?: string }, retries?: number): Promise<T>
  createWorkout(input: CreateWorkoutInput, idempotencyKey: string): Promise<Workout>
  createRun(input: CreateRunInput, idempotencyKey: string): Promise<Run>
  createWorkoutTemplate(input: CreateWorkoutTemplateInput, idempotencyKey: string): Promise<WorkoutTemplate>
  export function useIdempotencyKey(): { key: string; rotate: () => void }
  // useEntityForm options: onCreate: (input: TInput, idempotencyKey: string) => Promise<unknown>; onAlreadySaved?: () => void
  ```

- [ ] **Step 1: Write the failing tests** in `api-fetch.test.ts`:
  - `sends the Idempotency-Key header from the option` → the `fetch` mock's `init.headers` (a `Headers`) has `Idempotency-Key` equal to the key, and keeps `Content-Type`.
  - `retries a POST that carries an idempotency key on a network error` → `fetch` rejects with `TypeError` once, then resolves 201 → `fetch` called twice, the result returned.
  - `does not retry a PUT without a key` → `fetch` rejects with `TypeError` → rejects, `fetch` called once.
  - `does not retry a POST whose body contains the text idempotencyKey` → body `JSON.stringify({ idempotencyKey: "x" })`, no option → called once.
  - `still retries a GET` → called twice.
  - `throws ApiError with the status on a non-2xx response` → a 422 with `{ error: "msg" }` → `ApiError`, `status === 422`, `message === "msg"`.
- [ ] **Step 2: Run and see them fail** with `npx vitest run src/lib/data/api-client/__tests__/api-fetch.test.ts`.
- [ ] **Step 3: Implement `apiFetch`.** Separate `idempotencyKey` from the rest of the options, build `new Headers(rest.headers)` and set the key when present. The retry condition becomes "method absent, GET or HEAD, or the built headers have `Idempotency-Key`". Throw `new ApiError(res.status, …)` with the existing message fallback. Remove the "Exponential backoff could be added here" comment.
- [ ] **Step 4: Implement the wrappers.** The three `create*` wrappers take `idempotencyKey` and pass it as the option; `updateWorkout` and `updateRun` are unchanged and take no key. Export `ApiError` from `index.ts`.
- [ ] **Step 5: Implement the hooks.**
  - `useIdempotencyKey`: `useState(() => crypto.randomUUID())`, and `rotate` sets a new UUID.
  - `useEntityForm` calls it and invokes `onCreate(fields, key)`. After a successful create it calls `rotate()`.
  - In `catch`: if it's create mode and `err instanceof ApiError && err.status === 422`, call `rotate()`, invalidate `["user"]` and call `onAlreadySaved?.()`. The fields are kept, and `setError` shows the message as today.
- [ ] **Step 6: Implement the forms.**
  - `WorkoutForm` and `RunForm`: drop their own key `useState` and the `setIdempotencyKey` in `onSuccess`. `onCreate: (input, key) => createX({...}, key)`; `onUpdate` sends no key; `onAlreadySaved: onWorkoutLogged` / `onRunLogged`.
  - `CreateTemplateForm`: use `useIdempotencyKey()` and call `createWorkoutTemplate({ name, exercises }, key)`. On a 422 `ApiError`, call `rotate()`, invalidate `["workoutTemplates"]` and show the message, keeping the fields.
  - No new markup or classes.
- [ ] **Step 7: Run and see them pass.** `npx vitest run src/lib/data/api-client` passes; `npm run typecheck` and `npx eslint` on the changed files are clean.
- [ ] **Step 8: Commit**
  ```bash
  git add src/lib/data/api-client src/lib/hooks/useIdempotencyKey.ts src/lib/hooks/useEntityForm.ts src/components/workouts/WorkoutForm.tsx src/components/runs/RunForm.tsx src/components/workouts/CreateTemplateForm.tsx
  git commit -m "feat(client): send Idempotency-Key as a header and keep one key per form mount"
  ```

---

### Task 5: Remove the body fallback and the body field (layers: route platform, contracts, tests)

**Files:**
- Modify: `src/server/platform/http/define-route.ts`: no fallback; the header check moves **before** the body read.
- Modify: `src/shared/contracts/workout.ts`, `run.ts`, `template.ts`: delete `idempotencyKey`.
- Modify: `src/lib/types.ts`: delete `idempotencyKey` from the three input types.
- Modify: `src/components/workouts/WorkoutForm.tsx`, `src/components/runs/RunForm.tsx`: `CreateXSchema.omit({ idempotencyKey: true })` becomes `CreateXSchema`.
- Modify tests that put the key in inputs or bodies: `src/server/platform/http/__tests__/define-route.test.ts`, `src/lib/domain/__tests__/workout-evaluator.test.ts`, `run-evaluator.test.ts`, `src/lib/services/__tests__/update-quest-progress.test.ts`, `log-workout.test.ts`, `log-run.test.ts`, `create-workout-template.test.ts`, `src/app/api/workouts/__tests__/item-route.test.ts`, `src/app/api/runs/__tests__/item-route.test.ts`, and the Task 3 route tests if their bodies carry the key.

**Builds on:** Tasks 2–4. Document types keep `idempotencyKey` (it's stored on the entity).

**Interfaces:**
- Consumes: everything above.
- Produces: the final contract. Body schemas and input types have no `idempotencyKey`, the header is the only source, and a missing header returns 400 without reading the body.

- [ ] **Step 1: Write the failing test** in `define-route.test.ts`: `rejects a missing header before reading the body` → the request body is `"not json"` and there's no header → status 400 with the Idempotency-Key message (not `"Invalid JSON body"`), and `request.bodyUsed === false`. Delete the `falls back to body.idempotencyKey` test.
- [ ] **Step 2: Run and see it fail** with `npx vitest run src/server/platform/http/__tests__/define-route.test.ts`. Expected: the new case fails with "Invalid JSON body".
- [ ] **Step 3: Implement.** Move the header read and validation to right after the query parse; the fingerprint stays after the body parse. Delete the body fallback and its comment. Remove `idempotencyKey` from the three contracts and the three input types, then fix every compile error `npm run typecheck` reports by deleting the key from test inputs and bodies. The `user-scoped-repository` and `workout-templates-db` tests insert *documents*, which keep the key, so leave those alone.
- [ ] **Step 4: Verify that no body key remains.** `grep -rn "idempotencyKey" src/shared src/lib/types.ts src/components src/lib/data/api-client` returns nothing.
- [ ] **Step 5: Run everything.** `npm run typecheck && npm run test:run` passes.
- [ ] **Step 6: Commit**
  ```bash
  git add -A src
  git commit -m "feat(http): drop the body idempotencyKey fallback; header is the only source"
  ```

[[Plans Index]]
