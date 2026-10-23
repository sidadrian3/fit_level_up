# Idempotency Key Header

**Type:** feature-fullstack
**Areas:** infra, workouts, runs, templates
**Surfaces:** ui, api
**Pipeline outcome:** agentic
**Lane:** full

## Readiness at start

Assumptions: the 422 reuses each form's existing error line, with no new "info" style; `useEntityForm` gets an optional `onAlreadySaved` callback fed by the pages' existing refresh callbacks; a stale tab across the deploy gets one 400 until it refreshes.
Riskiest part: typing the `defineRoute` idempotency option without disturbing the inference of the ~25 existing routes.

## What was built

The three create routes declare `idempotency: "required"`. `defineRoute` reads a UUID `Idempotency-Key` header before the body, fingerprints the validated body (SHA-256) and hands both to the handler, which goes through `createOnce`: check, create, recheck on a duplicate key. A retry with the same key and body replays the stored entity as `201` plus `Idempotent-Replayed: true` and runs no side effect again; the same key with another body is `422`. `apiFetch` sends the header from an `idempotencyKey` option, throws `ApiError` carrying the status, and retries only GET/HEAD and requests that carry the header. A shared `useIdempotencyKey` hook holds one key per form mount and rotates after a success or a 422. The body field and its fallback are gone.

## Decisions made

- Fingerprint the whole validated body, so any edit under a reused key is a 422 rather than a silently dropped edit. apartment-system compares chosen fields and relies on a bill state machine; FitLevelUp has no such guard, and a new key on edit would double-log a workout and its XP.
- 201 on replay, not the overhaul spec's 200: `Idempotent-Replayed` already marks the replay, and it matches the IETF draft and Stripe. The spec's 8-128 character key became a UUID.
- A stored document with no fingerprint is a 422, not a replay: no real request can match a pre-change document once the body fallback is gone, so a legacy branch would be dead code.
- Concurrent twins replay instead of the draft's 409: the unique index serialises them and the person sees a success.
- PUT and DELETE are no longer auto-retried, and edit forms send no key.
- `exercises.create` and `friends.request` stay on natural keys. They answer a retry with 409; logged in Known Issues.
- Review follow-up: a body-less idempotent route would have crashed `hash.update` with a 500, so the fingerprint hashes `body ?? null`; `rotate` is memoized so `useEntityForm`'s callback stays stable; fingerprint-stored tests for runs and templates and an XP-once check for runs were added. Pushed back on a data-layer mapping helper (a one-line map in three files) and on the `(ctx: never)` cast (required by TS2394).

## Verification

Escalations: none
UI verified: API flow driven through the live routes on a throwaway account (no header 400, create 201, replay 201 + header, changed body 422, body-only key 400; XP and `totalWorkouts` counted once), then /workouts, /runs, /dashboard and /templates/new rendered with no console errors. The form's 422 path was not driven in a browser (the fallback script only loads pages, and no Playwright MCP was available), and `useEntityForm` / `CreateTemplateForm` have no hook test (no testing-library installed).
Handbook: Data Model And API Reference, Domain Architecture, Project Briefing, Architecture Overhaul Audit (step 2.4 Done)

## Notes

Port 3000 on this machine serves apartment-system's web app, so the UI check ran this project on port 3100 with `NEXT_PUBLIC_BETTER_AUTH_URL` overridden. The throwaway account `ui-check-idempotency@example.test` (two workouts, one run, one template) was created on the remote `fitlevelup` database and is not deleted. Step 2.5 (the outbox) builds on the same `defineRoute` pipeline.
