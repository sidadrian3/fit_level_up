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

[[Guides Index]]
