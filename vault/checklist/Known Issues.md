# Known Issues

Open issues found while documenting the codebase for the vault (2026-10-20). When one is fixed, delete its section here and run the pipeline's Handbook Sync so [[Data Model And API Reference]] stops describing it.

---

## 1. A declined friend request can be re-sent without limit

**Where:** `sendFriendRequest` in `src/lib/services/friends/send-friend-request.ts` reopens a declined pair as `pending` every time the requester asks again.

**Effect:** declining is silent, so a declined requester can keep re-sending. Each send publishes a fresh `friend_request` notification to the receiver. The only brake is the shared 20-per-hour mutation limit.

**Fix:** a product decision, either a cooldown after a decline (a `GAME_CONFIG` value checked against the document's `updatedAt`) or a block that only the decliner can lift. Not done in the audit's Phase 0 because it adds a new rule.

**Found in:** `src/lib/services/friends/send-friend-request.ts`, `src/lib/data/friendships-db.ts`.

---

## 2. A retried custom-exercise create or friend request answers 409

**Where:** `createCustomExercise` and `sendFriendRequest` dedupe on natural keys (`{ userId, name, targetMuscle }`, `pairKey`) and throw `ConflictError` on a duplicate.

**Effect:** no duplicate rows, but when the first attempt succeeded and its response was lost, a manual retry shows "already created" / "Friend request already sent" as an error, so the person thinks it failed.

**Fix:** return the existing exercise or pending request on a duplicate instead of throwing, which needs a product call on whether a deliberate re-add should silently succeed. An `Idempotency-Key` does not fit: the data already defines uniqueness. See [[Idempotency Key Header Design Spec]].

**Found in:** `src/lib/services/exercises/create-custom-exercise.ts`, `src/lib/services/friends/send-friend-request.ts`.

[[Guides Index]]
