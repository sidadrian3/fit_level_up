# Idempotency Key Header Design Spec

**Status:** Approved, 2026-10-23, after a brainstorm and grilling pass. Closes audit finding F-20 (step 2.4 in [[Architecture Overhaul Audit]]) and implements the `idempotency` option of `defineRoute` in [[Architecture Overhaul Design Spec]], with the amendments listed under Decisions. Full-stack; the design critique (Step 3.5) ran as an in-context pass over the one new UI state (the 422 message), since the change adds no new elements.

## Problem Statement

`apiFetch` decides a POST is safe to retry by searching the JSON body text for `idempotencyKey`. That is string sniffing: any body that happens to contain the word is retried, and the edit forms put the key into their PUT bodies, so workout and run updates are retried by accident.

On the server, a retry with a known key returns the stored entity with the same `201` as the first request, so nothing tells the client it got a replay. A retry also re-runs the whole XP and stamina transaction just to fail on the unique index. Worst of all, a key reused with a **different** body is silently answered with the first entity. A person whose response was lost fixes a typo, submits again with the same key, and is told it saved, while their edit is gone.

`CreateTemplateForm` makes a fresh key on every submit, so a manual retry after a lost response creates a second template.

## Solution

Create routes (`workouts.create`, `runs.create`, `templates.create`) declare `idempotency: "required"`. `defineRoute` reads a UUID `Idempotency-Key` header and fingerprints the validated body. It passes both to the handler, which creates through a shared `createOnce` helper. A retry with the same key and the same fingerprint replays the stored entity: `201` plus `Idempotent-Replayed: true`. The same key with a different fingerprint gets `422`. `apiFetch` sets the header from an `idempotencyKey` option and retries on a network error only GET/HEAD requests and requests that carry the header. Forms keep one key per mount through a shared `useIdempotencyKey` hook, start a new one after a success or a 422, and show the 422's message.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | The header must be a UUID (`z.uuid()`); missing or invalid → `400 { error: "Missing or invalid Idempotency-Key header" }`. **Amends** the overhaul spec's "8–128 chars" | The only client is our own browser code, which always sends `crypto.randomUUID()`. It matches the keys already stored |
| 2 | A replay answers **201** with `Idempotent-Replayed: true`. **Amends** the overhaul spec's 200 | IETF draft §2.6 and Stripe return the original result. The header already says "replay"; a different status adds nothing, and "2xx means saved" stays simple for clients |
| 3 | Fingerprint = SHA-256 hex of `JSON.stringify` of the **Zod-validated** body, computed in `defineRoute`, stored as `idempotencyFingerprint` on the created document | Zod emits fields in schema order and strips unknown ones, so equal input hashes equally. Any change to the submitted values counts as a different request; comparing chosen fields would let an edit be silently dropped |
| 4 | Replay only when the stored fingerprint **equals** the request's. Anything else, including a document with no stored fingerprint, is a `422` | No real request can match a document from before this change (see Transition), so a "legacy replays" rule would be dead code. The server never claims "same request" for a payload it cannot verify |
| 5 | `422 IdempotencyKeyReusedError` (a new `AppError`), with a per-entity message | IETF draft §2.7. Stripe answers the same case with an error too |
| 6 | `createOnce` in `src/server/platform/http/idempotency.ts`: check first, create, and on a duplicate-key error check again | One copy of the replay logic instead of three. The check-first step means a replay no longer re-runs the transaction. The unique index stays the only source of truth; the recheck turns a lost race into a replay or a 422, never a 500 |
| 7 | A concurrent twin (same key, still in flight) waits on the index and then replays, instead of the draft's `409` | The person sees a success, not an error. The transaction and the unique index already serialise the two requests |
| 8 | `apiFetch` retries a network error only for GET/HEAD and requests with an `Idempotency-Key` header. PUT and DELETE are no longer retried; edit forms stop sending a key | Explicit beats sniffing. A lost update is safe to resubmit by hand; a retried DELETE would turn a success into a 404 |
| 9 | `apiFetch` throws `ApiError` (`status`, `message`) for non-2xx responses | The form must tell a 422 from other errors |
| 10 | The route-table test allows `idempotency` only on `auth: "user"` POST routes, and requires it nowhere | `exercises.create` and `friends.request` dedupe on natural keys (see Known gap). The three create routes are pinned by their own route tests, and the types force `IdempotentResult` |
| 11 | Body fallback (header, else `body.idempotencyKey`) exists only between commits inside this PR, and the last commit removes it with the body field | The PR deploys as one unit, so the fallback never reaches production. A tab still running the old bundle gets one `400` on submit until it refreshes. Production holds mostly test accounts (overhaul spec D5) |
| 12 | With the fallback gone, the header is checked **before** the body is read; the fingerprint is computed after parsing | A request without a key is rejected without reading or validating the JSON. While the fallback exists, the check must sit after parsing to see the body field |

## Contract

### Server

```ts
// src/server/platform/http/define-route.ts
export interface RouteOptions<A, B, Q, P, I extends "required" | undefined = undefined> {
  // … name, auth, body, query, params, throttle, status unchanged …
  /** Requires a UUID Idempotency-Key header; only on auth "user" POST routes (route-table test). */
  idempotency?: I;
}

export interface IdempotencyRequest { key: string; fingerprint: string }

export interface RouteContext<A, B, Q, P, I> {
  // … request, userId, body, query, params unchanged …
  idempotency: I extends "required" ? IdempotencyRequest : undefined;
}

// Handler result: I extends "required" ? IdempotentResult<T> : T | Response
export interface IdempotentResult<T> { value: T; replayed: boolean }
```

Pipeline, final form (after the fallback is removed):

1. Auth → 401.
2. Throttle → 429 + `Retry-After`.
3. Params, query.
4. **Idempotency header** (when `idempotency: "required"`): `Idempotency-Key` parsed with `z.uuid()` → `BadRequestError("Missing or invalid Idempotency-Key header")`.
5. Body: read JSON, parse with Zod → 400.
6. **Fingerprint**: `sha256(JSON.stringify(body))`, hex.
7. Handler with `ctx.idempotency = { key, fingerprint }`.
8. Response: for an idempotent route the `IdempotentResult` becomes `NextResponse.json(value, { status })`, plus `Idempotent-Replayed: true` when `replayed`.

```ts
// src/server/platform/http/idempotency.ts
export interface IdempotentRecord<T> { value: T; fingerprint: string | undefined }

export async function createOnce<T>(options: {
  request: IdempotencyRequest;
  findExisting: () => Promise<IdempotentRecord<T> | null>;
  create: () => Promise<T>;
  reusedMessage: string;
}): Promise<IdempotentResult<T>>;
// 1. findExisting → equal fingerprint: { value, replayed: true }; otherwise throw IdempotencyKeyReusedError(reusedMessage)
// 2. create → { value, replayed: false }
// 3. create throws isDuplicateKeyError(err, "idempotencyKey") → repeat step 1; if still nothing found, rethrow

// src/server/platform/http/errors.ts
export class IdempotencyKeyReusedError extends AppError { /* statusCode 422 */ }
```

Services:

| Service | New signature | `reusedMessage` |
|---|---|---|
| `logWorkout` | `(input, userId, idempotency) → Promise<IdempotentResult<Workout>>` | "This workout was already saved with your earlier details. Check your history to edit it, or submit again to log a new one." |
| `logRun` | `(input, userId, idempotency) → Promise<IdempotentResult<Run>>` | "This run was already saved with your earlier details. Check your history to edit it, or submit again to log a new one." |
| `createWorkoutTemplate` | `(input, userId, idempotency) → Promise<IdempotentResult<WorkoutTemplate>>` | "This template was already saved with your earlier details. Submit again to save a new one." |

Each wraps its existing write (the transaction for workouts and runs) in `createOnce`. The `after()` achievement evaluation runs only when `replayed` is false. The existing `getWorkoutByIdempotencyKey`, `getRunByIdempotencyKey` and `getWorkoutTemplateByIdempotencyKeyFromDb` return `IdempotentRecord<T>` (entity plus stored fingerprint). Inserts write `idempotencyKey` and `idempotencyFingerprint`.

Body schemas (`CreateWorkoutSchema`, `CreateRunSchema`, `WorkoutTemplateSchema`) and the input types in `src/lib/types.ts` lose `idempotencyKey` in the final commit. The PUT routes keep using the same schemas, now without a key.

### Data

- `workouts`, `runs`, `workout_templates`: new optional field `idempotencyFingerprint: string`, added to each `$jsonSchema` validator's `properties` in `schema.ts` (not to `required`).
- No new index: the unique partial `{ userId, idempotencyKey }` index stays the source of truth. No migration: older documents simply lack the field (Decision 4).

### Client

```ts
// src/lib/data/api-client/api-fetch.ts
export class ApiError extends Error { constructor(public status: number, message: string) }

export async function apiFetch<T>(
  url: string,
  options?: RequestInit & { idempotencyKey?: string },
  retries = 2,
): Promise<T>;
// sets header "Idempotency-Key" when idempotencyKey is given
// retry on TypeError only if method is GET/HEAD/absent, or the request carries the header
// non-2xx → throw new ApiError(res.status, body.error ?? `Request failed: ${url}`)
```

- `createWorkout(input, idempotencyKey)`, `createRun(input, idempotencyKey)`, `createWorkoutTemplate(input, idempotencyKey)` pass the key to `apiFetch`. `updateWorkout` and `updateRun` send no key.
- `useIdempotencyKey()` in `src/lib/hooks/`: `{ key, rotate }`, the key made once with `useState(() => crypto.randomUUID())`.

## UI

No new elements. Each form's existing error line carries the new state.

| Event | `WorkoutForm` / `RunForm` (via `useEntityForm`) | `CreateTemplateForm` |
|---|---|---|
| 201 (new or replay) | as today: reset fields, `rotate()`, invalidate `["user"]`, page callback refreshes lists | as today: invalidate `["workoutTemplates"]`, navigate to `/workouts` |
| 422 | show the server message, **keep** the edited fields, `rotate()`, invalidate `["user"]`, call `onAlreadySaved` (the page's refresh callback, so the saved entry appears) | show the message, keep fields, `rotate()`, invalidate `["workoutTemplates"]` |
| network error after retries, other errors | show the message, keep the key, so a manual retry is still a replay | same |

`useEntityForm` owns the key: `onCreate(input, idempotencyKey)`, plus a new optional `onAlreadySaved` option. `WorkoutForm` and `RunForm` drop their own `useState` key and pass their `onWorkoutLogged` / `onRunLogged` as `onAlreadySaved`. Edit mode never uses the key.

**Design critique (Step 3.5):** the 422 copy is a plain statement plus the next action, shown in the existing red error line. It doesn't dress a recoverable state up as a failure in new chrome. A distinct "info" tone was considered and rejected: the forms have one message slot, and adding a variant for one rare state is not worth a new primitive. No motion changes.

## Transition (commits inside this PR)

1. Server: `defineRoute` reads the header, **or else** `body.idempotencyKey` (checked after the body parse); body fields become optional; replay header, fingerprint and 422 in place.
2. Client: `apiFetch` option and `ApiError`, `useIdempotencyKey`, forms send the header.
3. Remove the fallback and the body field from schemas and types; move the header check before the body read.

## Testing

- **`define-route.test.ts`**: a required-idempotency route without the header → 400 and the handler doesn't run; a non-UUID header → 400; the handler receives `{ key, fingerprint }`; the same body in a different field order gives the same fingerprint; `replayed: true` adds the header with status 201; `replayed: false` has no header; after commit 3, a missing header returns 400 without reading the body.
- **`idempotency.test.ts`** (against the replica set, a throwaway collection with the unique partial index): first call creates; same fingerprint replays; different fingerprint throws `IdempotencyKeyReusedError`; a stored document without a fingerprint throws; two racing calls produce one document, and the loser replays.
- **Service integration** (`log-workout`, `log-run`, `create-workout-template`): replay returns `replayed: true`, one document, XP and quests applied once; a different body with the same key → 422 and state unchanged; the stored document carries `idempotencyFingerprint`.
- **Route tests** (workouts, runs, templates): 400 without the header, 201 + `Idempotent-Replayed` on replay, 422 on mismatch.
- **`route-table.test.ts`**: `idempotency` only on user POST routes.
- **`api-fetch`**: a POST with the key retries on `TypeError`; a PUT doesn't; a GET still does; non-2xx throws `ApiError` with the status.

## Known gap (logged, not fixed here)

`exercises.create` and `friends.request` dedupe on natural keys (`{ userId, name, targetMuscle }`, `pairKey`), so they can never create duplicates. But a retry after a lost response answers **409** ("already created" / "already sent") even though the first attempt worked. The fix is to return the existing entity on a duplicate, not a key; it needs a product call on whether a deliberate re-add should silently succeed. Recorded in [[Known Issues]].

## Out of Scope

- Idempotency for `exercises.create`, `friends.request`, quest claims or any PUT/DELETE.
- Key expiry: keys live on the entity for its lifetime, so there is nothing to purge.
- Client UI for `Idempotent-Replayed` (the client treats a replay as a success).

[[Specs Index]]
