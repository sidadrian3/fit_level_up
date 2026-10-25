# Achievements Social And Notifications

**Type:** feature-fullstack
**Areas:** achievements, friends, sse, stats, profile, database
**Surfaces:** ui, api-only
**Pipeline outcome:** agentic
**Lane:** full

## Readiness at start

Assumptions: `$type: "null"` is accepted in a partial index filter; achievement definitions in `src/shared` are fine to ship to the browser; notification may import social's public API; listener names kept so rows pending across the deploy run once; no numbered migration needed because `applySchema` creates `notifications`.
Riskiest part: the client poll hook (since-cursor merge, fast window, toast rule) with no DOM test environment.

## What was built

Audit steps 3.6, 3.7 and 3.8 on one branch. `src/server/achievements` evaluates on outbox events and emits `achievement.unlocked`; `src/server/social` owns friendships (transition table, batched lists, lazy records, decline cooldown, `friendship.*` events); `src/server/notification` writes a `notifications` inbox from the listeners and serves `GET /api/notifications` and `PATCH /api/notifications/read`. The browser polls the inbox and shows a bell, a panel and one toast. SSE, the Redis queue and the old friend and achievement services are deleted. Specs: [[Achievements Social And Notifications Design Spec]]; plan: [[Achievements Social And Notifications Plan]].

## Decisions made

- Friends' personal records load lazily from `GET /api/friends/[id]/records` (404 unless accepted): the list computed four queries per friend for a modal most visits never open. The audit's "preserved response" line was deliberately broken.
- The re-request cooldown (7 days, `GAME_CONFIG.social.friendRequestCooldownDays`) binds only the declined person and answers like a pending duplicate, so a decline stays silent; the decliner can reopen at any time with the roles swapped; removing a declined pair answers 404 so remove cannot dodge the cooldown.
- The cooldown reads the declined document's `updatedAt`: no new field or migration.
- After the user's own successful mutation the bell polls every 2 s for up to 10 s, extended rather than stacked. It is a timing heuristic over `after()` listeners, recorded as a known compromise in [[Known Issues]] with better candidates.
- At most one toast, only for entries that arrive while the tab is visible; the badge and tab title carry the catch-up after time away.
- Request notifications stay unread after the user acts on the request: clearing them needed a `friendship.declined` event for no real gain.
- Achievement definitions moved to `src/shared`; the bell renders unlocks from them and notification cannot import achievements. The dashboard's achievement count is passed into `getDashboardStats` as a callback.
- One `NotificationProvider` owns the poll hook; the review found the sidebar bell and `NotificationCenter` each ran their own copy, which could lose a toast.

## Verification

Escalations: none
UI verified: dashboard, friends modal and the mobile viewport, with two throwaway accounts on a dev server on port 3100 against the shared Atlas database (user's choice), cleaned up afterwards; screenshots in the session scratchpad. The first run found the mobile bell covering the page header's "+ Log Run" button, fixed with a top band.
Handbook: Data Model And API Reference, Domain Architecture, Project Briefing, Developer Handbook, Developer SOP Guide

## Notes

- Tests: 432 before, 464 after. Five test files cover the work; the old friend and achievement tests moved into them.
- The Atlas dev database has never had the numbered migrations applied (no `outbox`, `player_profiles` or `schema_migrations`, and the legacy `idx_friendships_requester_receiver` index with no `pairKey` unique index), so a duplicate friend request there returns 500 instead of 409. A migrated database answers 409.
- Port 3000 on this machine serves the apartment-system project; the UI check ran this app on 3100.
- Architecture Review still describes SSE; it is superseded by step 5.1.
- Review pushed back on: fast window on unkeyed mutations (spec says any), the `visibleSince` race (the focus refetch awaits the network first), the accept actor check not in the write filter (needs a decline and reopen inside one request), and the shared listener name (unique per event by design).

[[History Index]]
