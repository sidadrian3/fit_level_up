# Known Issues

Open issues found while documenting the codebase for the vault (2026-10-20). When one is fixed, delete its section here and run the pipeline's Handbook Sync so [[Data Model And API Reference]] stops describing it.

---

## 1. A retried custom-exercise create or friend request answers 409

**Where:** `createCustomExercise` and `sendFriendRequest` dedupe on natural keys (`{ userId, name, targetMuscle }`, `pairKey`) and throw `ConflictError` on a duplicate.

**Effect:** no duplicate rows, but when the first attempt succeeded and its response was lost, a manual retry shows "already created" / "Friend request already sent" as an error, so the person thinks it failed.

**Fix:** return the existing exercise or pending request on a duplicate instead of throwing, which needs a product call on whether a deliberate re-add should silently succeed. An `Idempotency-Key` does not fit: the data already defines uniqueness. See [[Idempotency Key Header Design Spec]].

**Found in:** `src/server/training/exercises/exercise.service.ts`, `src/server/social/friendship.service.ts`.

---

## 2. Notification fast-poll window is a timing heuristic

**Where:** `useNotifications` in `src/lib/notifications/useNotifications.ts` polls every 2 s for up to 10 s after the user's own successful mutation, then returns to 30 s.

**Effect:** the achievement and notification listeners run in `after()`, so an immediate refetch can miss the entry. The window bets that a listener finishes within 10 s. A slower listener falls back to the 30 s poll, so the entry still arrives, only later.

**Fix:** replace the sleep-based window with one of the D-5 candidates:
- The mutation response carries the emitted event ids and the client polls a status endpoint until they are processed. Exact, but new machinery on every mutation route.
- Push delivery (Pusher, Ably), which removes polling entirely.

**Found in:** `src/lib/notifications/useNotifications.ts`. See [[Achievements Social And Notifications Design Spec]].

---

## 3. Dashboard and profile can show old numbers after browser Back

**Where:** `/dashboard` and `/profile` are `force-dynamic` Server Components. They render XP, level, the stat cards, achievements and recent activity on the server, so no client query holds those values. See [[Frontend Domain Hooks Plan]] for why they stay server-rendered.

**Effect:** reaching either page by a sidebar link or a reload is fresh. Next 16's client cache reuses a visited page on browser back/forward navigation (Next docs, Glossary: Client Cache), so pressing Back to one of them after logging a workout or run or claiming a quest shows the numbers from when the page was last rendered. The sidebar XP bar is a client query and is already fresh, so the two can disagree until the next forward navigation. This comes from the Next docs and has not been reproduced in a browser.

**Fix:** either of:
- Call `router.refresh()` when one of these pages is restored from history (a small client component listening for `pageshow`). Cheap, and keeps the pages on the server.
- Move the dashboard and profile numbers to client queries whose keys the activity mutations already invalidate. This reverses the decision to keep them server-rendered.

**Found in:** `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/profile/page.tsx`.

---

[[Guides Index]]
