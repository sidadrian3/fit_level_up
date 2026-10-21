# Known Issues

Open issues found while documenting the codebase for the vault (2026-10-20). When one is fixed, delete its section here and run the pipeline's Handbook Sync so [[Data Model And API Reference]] stops describing it.

---

## 1. A declined friend request can be re-sent without limit

**Where:** `sendFriendRequest` in `src/lib/services/friends/send-friend-request.ts` reopens a declined pair as `pending` every time the requester asks again.

**Effect:** declining is silent, so a declined requester can keep re-sending. Each send publishes a fresh `friend_request` notification to the receiver. The only brake is the shared 20-per-hour mutation limit.

**Fix:** a product decision, either a cooldown after a decline (a `GAME_CONFIG` value checked against the document's `updatedAt`) or a block that only the decliner can lift. Not done in the audit's Phase 0 because it adds a new rule.

**Found in:** `src/lib/services/friends/send-friend-request.ts`, `src/lib/data/friendships-db.ts`.

[[Guides Index]]
