# Achievements Social And Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achievements become an outbox listener, friendships become a `social` module with a transition table, batched loading and a decline cooldown, and a persistent notification inbox with a polled bell replaces the Redis SSE feed.

**Architecture:** Three modules under `src/server` (`achievements`, `social`, `notification`) connected only by outbox events, wired in `src/server/runtime.ts`. Notification is listener-only and writes a `notifications` collection. The browser polls it through `useNotifications` and renders a bell, a panel and one toast.

**Tech Stack:** Next.js 16 App Router, MongoDB (in-memory replica set in tests), Zod, TanStack Query 5, Tailwind v4, Vitest 4, lucide-react.

**Spec:** [[Achievements Social And Notifications Design Spec]] (`vault/specs/Achievements Social And Notifications Design Spec.md`). Read it first; this plan does not repeat its tables.

## Global Constraints

- Every route uses `defineRoute` from `@/server/runtime`. A user mutation names `throttle: "standard"` and a `body` (the route-table test enforces it).
- G5: no file under `src/server/` except `runtime.ts` imports `@/server/achievements` or `@/server/notification`. `src/app/**` may import both. Tests under `src/server/**` count too: stub, don't import.
- E1: import other modules only through their `index.ts`. Every new `index.ts` under `src/server` starts with `import "server-only";`.
- Rules files (`*.rules.ts`) import nothing from `mongodb`, `next`, `platform/{database,http,events,auth,env}` or repositories, and take `now` as an argument.
- `GAME_CONFIG.social.friendRequestCooldownDays = 7`.
- Client constants: `NOTIFICATION_POLL_INTERVAL_MS = 30_000`, `FAST_POLL_INTERVAL_MS = 2_000`, `FAST_POLL_WINDOW_MS = 10_000`.
- Feed limits: `since` → at most 50 rows; no `since` → latest 20. Mark-read ids: 1–50. TTL 90 days (`7776000` s).
- Listener names (unique per event): `achievements.evaluate`, `notification.friend-requested`, `notification.friend-accepted`, `notification.friend-leveled-up`, `notification.achievement-unlocked`.
- Error copy, verbatim: `"Friend request already sent."`, `"Friend request is not pending."`, `"Not authorized to respond to this request."`, `"Friendship not found."`, `"Friend not found."`, `"User not found."`, `"Cannot send a friend request to yourself"`.
- Test files are limited to the five named in the spec's Testing section plus edits to `outbox-sweep.test.ts`, the achievements route test and `get-dashboard-stats.test.ts`. Do not add others.
- Commit messages: `feat(<scope>): …`, with no `Co-Authored-By` trailer.

## Review Focus

1. **A friend whose account was deleted:** `GET /api/friends` and `/requests` skip them instead of returning 500 (today `getUser` throws). Test in Task 3.
2. **`DELETE /api/friends/[id]` on a declined pair, by the declined requester:** 404 `"Friendship not found."`, and a following send within 7 days still answers 409 (no cooldown bypass). Test in Task 3.
3. **A poll whose `since` equals the newest row's `createdAt`:** `$gte` returns that row again, and the client merge must not duplicate it. Test in Task 5.
4. **`PATCH /api/notifications/read` with another user's id:** the id is ignored, and their row stays unread. Test in Task 4.
5. **Level-up fan-out with pending and declined pairs:** only accepted friends get a row; a user with no friends writes nothing. Test in Task 4.

---

## File Structure

| Path | Responsibility | Task |
|---|---|---|
| `src/shared/achievement-definitions.ts` | `ACHIEVEMENT_DEFINITIONS`, `AchievementCondition`, `AchievementRarity` (moved) | 1 |
| `src/shared/contracts/notification.ts` | `Notification` wire type, `NotificationsQuerySchema`, `MarkNotificationsReadSchema` | 1 |
| `src/server/platform/database/schema.ts` | `NotificationDoc`, `notifications` collection, indexes, validator | 1 |
| `src/server/platform/auth/account.ts` | `getAccounts` | 1 |
| `src/server/progression/get-player-state.ts` | `getPlayerStates` | 1 |
| `src/server/achievements/*` | the module (spec Contract) | 2 |
| `src/server/social/*` | the module | 3 |
| `src/app/api/friends/[id]/records/route.ts` | lazy records | 3 |
| `src/server/notification/*` | the module | 4 |
| `src/app/api/notifications/route.ts`, `…/read/route.ts` | the feed routes | 4 |
| `src/lib/notifications/{constants,notification-feed,useNotifications}.ts` | client feed logic | 5 |
| `src/lib/data/api-client/notifications.ts` | fetch wrappers | 5 |
| `src/components/notifications/{NotificationBell,NotificationPanel,NotificationToast,NotificationCenter}.tsx` | UI | 6 |

---

### Task 1: Contracts, schema and batch reads

**Layer:** data. **Group:** none (everything after depends on it).

**Files:**
- Create: `src/shared/achievement-definitions.ts` (content of `src/server/achievements/achievement.definitions.ts`, with `rarity: AchievementRarity` defined locally instead of importing `@/lib/types`)
- Move: `src/server/achievements/__tests__/achievement.definitions.test.ts` → `src/shared/__tests__/achievement-definitions.test.ts` (import path only)
- Delete: `src/server/achievements/achievement.definitions.ts`
- Modify: `src/server/achievements/index.ts` (re-export from `@/shared/achievement-definitions`), `src/lib/types.ts` (`Achievement.rarity: AchievementRarity`)
- Create: `src/shared/contracts/notification.ts`
- Modify: `src/server/platform/database/schema.ts`, `src/server/platform/database/index.ts` (export `NotificationDoc`)
- Modify: `src/server/platform/auth/account.ts`, `src/server/platform/auth/index.ts`
- Modify: `src/server/progression/get-player-state.ts`, `src/server/progression/index.ts`
- Modify: `src/server/platform/config/game-config.ts` (`social: { friendRequestCooldownDays: 7 }`)

**Interfaces:**
- Produces:
  - `ACHIEVEMENT_DEFINITIONS`, `type AchievementCondition`, `type AchievementRarity = "common" | "rare" | "epic" | "legendary"` from `@/shared/achievement-definitions`
  - `type Notification` (spec wire type), `NotificationsQuerySchema = z.object({ since: z.iso.datetime().optional() })`, `MarkNotificationsReadSchema = z.union([z.object({ ids: z.array(z.string()).min(1).max(50) }), z.object({ all: z.literal(true) })])`, plus inferred `MarkNotificationsReadInput`, from `@/shared/contracts/notification`
  - `type NotificationDoc` (C7, with `_id: ObjectId` required, so it satisfies `UserOwnedDoc`) and the `COLLECTIONS.notifications = "notifications"` key `"notifications"`
  - `getAccounts(userIds: string[], options?: { session?: ClientSession }): Promise<Account[]>`, one `$in` query; skips invalid and missing ids; keeps no particular order
  - `getPlayerStates(entries: { userId: string; timeZone: string }[], options?: { now?: Date }): Promise<Map<string, PlayerState>>`, one `$in` query on profiles; a missing profile maps to `newProfileDefaults(now)`

- [ ] **Step 1: Move the definitions and run the moved test**

Run: `npx vitest run src/shared/__tests__/achievement-definitions.test.ts`
Expected: PASS (1 test)

- [ ] **Step 2: Add the `notifications` entry to `SCHEMA`**

Indexes, exactly:
```ts
{ key: { userId: 1, sourceEventId: 1 }, name: "idx_notifications_source", unique: true },
{ key: { userId: 1, createdAt: -1 }, name: "idx_notifications_feed" },
{ key: { createdAt: 1 }, name: "idx_notifications_ttl", expireAfterSeconds: 7776000 },
{ key: { userId: 1 }, name: "idx_notifications_unread", partialFilterExpression: { readAt: { $type: "null" } } },
```
Validator: required `userId` (string), `sourceEventId` (objectId), `type` (enum of the four), `data` (object), `actor` (`["object", "null"]`), `createdAt` (date), `readAt` (`["date", "null"]`).

- [ ] **Step 3: Implement `getAccounts`, `getPlayerStates` and the `GAME_CONFIG.social` entry**

`getAccounts` maps each document with the same fallbacks as `getAccount` (extract the mapping into one private `toAccount(doc)`, used by both). `getPlayerStates` reuses `toPlayerState`.

- [ ] **Step 4: Verify: the whole suite applies the new schema and partial index**

Run: `npm run typecheck && npm run test:run`
Expected: all pass. A rejected `partialFilterExpression` would fail global setup here. If `$type: "null"` is rejected, use `{ readAt: { $eq: null } }` and note it in the commit body.

- [ ] **Step 5: Commit**

```bash
git add -A src/shared src/server/achievements src/server/platform src/server/progression src/lib/types.ts
git commit -m "feat(platform): notification contracts, schema and batch account and player reads"
```

---

### Task 2: achievements module as an outbox listener

**Layer:** service + data + route. **Group:** none (Task 3 edits `outbox-sweep.test.ts` after this task does).

**Files:**
- Create: `src/server/achievements/{events.ts, achievement.rules.ts, achievement.repository.ts, evaluate-achievements.ts, list-achievements.ts}`
- Modify: `src/server/achievements/index.ts`
- Create: `src/server/achievements/__tests__/achievements.test.ts` (replaces `src/lib/services/__tests__/evaluate-achievements.test.ts`)
- Delete: `src/lib/services/achievements/evaluate-achievements.ts`, `src/lib/services/__tests__/evaluate-achievements.test.ts`, `src/lib/domain/achievement-rules.ts`, `src/lib/data/achievements-db.ts`
- Modify: `src/server/runtime.ts` (the two `achievements.evaluate` entries come from `achievementListeners`)
- Modify: `src/server/training/dashboard/get-dashboard-stats.ts`, its test, `src/app/api/stats/dashboard/route.ts`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/profile/page.tsx`, `src/app/api/achievements/route.ts`
- Modify: `src/app/api/cron/__tests__/outbox-sweep.test.ts` (delivered count)

**Interfaces:**
- Consumes: `getPlayerState(userId, { now, session })` from `@/server/progression`; `emit`, `defineListener` from `@/server/platform/events`; `ACHIEVEMENT_DEFINITIONS` from `@/shared/achievement-definitions`
- Produces (from `@/server/achievements`):
  - `achievementListeners: AnyListener[]` (two entries named `achievements.evaluate`, on `activity.logged` and `progression.leveled-up`)
  - `listAchievements(userId: string): Promise<Achievement[]>`, the exact `GET /api/achievements` shape
  - `countUnlockedAchievements(userId: string): Promise<number>`
  - `evaluateAchievements(userId: string, now?: Date): Promise<string[]>` (newly unlocked ids; exported for tests)
  - Event `"achievement.unlocked": { userId: string; achievementId: string }`
- Produces (training): `getDashboardStats(userId, user, { countAchievements, now }: { countAchievements: (userId: string) => Promise<number>; now?: Date })`

- [ ] **Step 1: Write the failing integration tests in `achievements.test.ts`**

Port every case from the old `evaluate-achievements.test.ts` against `evaluateAchievements`, then add:
```ts
it("emits achievement.unlocked once per new unlock, in the same transaction", async () => {
  const userId = await seedPlayer({ profile: { totalWorkouts: 1 } });
  expect(await evaluateAchievements(userId)).toEqual(["first_workout"]);
  const rows = await (await getCollection("outbox")).find({ type: "achievement.unlocked", "payload.userId": userId }).toArray();
  expect(rows.map((row) => row.payload)).toEqual([{ userId, achievementId: "first_workout" }]);
});

it("concurrent evaluations insert one unlock and emit one event", async () => {
  const userId = await seedPlayer({ profile: { totalWorkouts: 1 } });
  const [a, b] = await Promise.all([evaluateAchievements(userId), evaluateAchievements(userId)]);
  expect([...a, ...b]).toEqual(["first_workout"]);
  expect(await (await getCollection("outbox")).countDocuments({ type: "achievement.unlocked", "payload.userId": userId })).toBe(1);
});

it("countUnlockedAchievements and listAchievements reflect unlocks", async () => { /* 1 unlocked of 5; unlocked: true and an unlockedDate only on first_workout */ });
```
The rules unit cases (each metric ≥ target, below target) go in the same file as a `describe("isConditionMet")`: no separate rules test file.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/server/achievements`
Expected: FAIL (module exports missing)

- [ ] **Step 3: Implement the module**

- `achievement.rules.ts`:
  - `isConditionMet(condition: AchievementCondition, stats: Pick<PlayerState, "totalWorkouts" | "totalDistance" | "level" | "streak">): boolean`, a lookup table keyed by `metric`, not a `switch` (Open/Closed rule);
  - `findNewUnlocks(definitions, unlockedIds: ReadonlySet<string>, stats): string[]`.
- `achievement.repository.ts`: `userScopedRepository` on `"userAchievements"` (intersect the doc type with `UserOwnedDoc`, as `quest.repository.ts` does), with:
  - `findUnlocks(userId, session?)`, limit `MAX_FIND_LIMIT`;
  - `upsertUnlocks(userId, achievementIds, unlockedDate, session): Promise<string[]>`, returning the ids actually inserted. Use `$setOnInsert` with a raw `bulkWrite` through `upsertMany`'s collection; if `upsertMany` can't report `upsertedIds`, add the bulk write in this repository with `userId` in every filter;
  - `countUnlocks(userId)`.
- `evaluate-achievements.ts`:
  1. Read `getPlayerState` and the unlocks.
  2. If `findNewUnlocks` is empty, return `[]` without opening a transaction.
  3. Otherwise, in one `withTransaction`: `upsertUnlocks`, then `emit("achievement.unlocked", …, { session })` for each inserted id.
  4. `unlockedDate` is `now.toISOString()`.
- The two listeners call `evaluateAchievements(payload.userId)`.

- [ ] **Step 4: Switch the callers**

- `runtime.ts`: `const LISTENERS = [...achievementListeners, <existing friend level-up adapter>]`.
- `getDashboardStats`: take `{ countAchievements, now }`; its test passes `countAchievements: async () => 2` and keeps its assertions.
- Stats route, dashboard page and profile page: pass `countUnlockedAchievements`.
- Profile page and achievements route: use `listAchievements`.
- `outbox-sweep.test.ts`: the first sweep now delivers the chained `achievement.unlocked` row too, so expect `{ delivered: 3, failed: 0, dead: 0 }`.

- [ ] **Step 5: Run the affected tests, typecheck and lint**

Run: `npx vitest run src/server/achievements src/server/training src/app/api/achievements src/app/api/cron && npm run typecheck && npx eslint src/server/achievements src/server/runtime.ts src/server/training/dashboard && npx depcruise src --config .dependency-cruiser.cjs`
Expected: PASS; no G5 violation

- [ ] **Step 6: Commit**

```bash
git add -A src/server/achievements src/server/runtime.ts src/server/training/dashboard src/app src/lib/services src/lib/domain src/lib/data
git commit -m "feat(achievements): achievements module evaluates from outbox events and emits achievement.unlocked"
```

---

### Task 3: social module

**Layer:** domain + service + data + route (+ the one modal change its response change forces).

**Files:**
- Create: `src/server/social/{index.ts, events.ts, friendship.rules.ts, friendship.repository.ts, send-friend-request.ts, respond-to-request.ts, remove-friend.ts, list-friends.ts, get-friend-records.ts}`
- Create: `src/server/social/__tests__/friendship.rules.test.ts`, `src/server/social/__tests__/social.test.ts`
- Create: `src/app/api/friends/[id]/records/route.ts`
- Modify: the five friend routes (`friends`, `friends/requests`, `friends/request`, `friends/[id]`, `friends/[id]/accept`, `friends/[id]/decline`) to import from `@/server/social`
- Modify: `src/lib/services/friends/notify-friends-level-up.ts` (read ids via `getAcceptedFriendIds` from `@/server/social`; Task 4 deletes the file)
- Modify: `src/lib/types.ts` (`FriendProfile` drops `personalRecords`), `src/lib/data/api-client/friends.ts` (`getFriendRecords`), `src/components/friends/FriendProfileModal.tsx`
- Modify: `src/app/api/cron/__tests__/outbox-sweep.test.ts` (import `buildFriendshipPairKey` from `@/server/social`)
- Delete: the other six files in `src/lib/services/friends/`, `src/lib/domain/friend-rules.ts`, `src/lib/domain/__tests__/friend-rules.test.ts`, `src/lib/data/friendships-db.ts`, `src/lib/data/__tests__/friendships-db.test.ts`, `src/lib/services/__tests__/friends.test.ts`

**Interfaces:**
- Consumes: `getAccounts`, `getPlayerStates` (Task 1); `getPersonalRecords(userId)` from `@/server/training`; `GAME_CONFIG.social.friendRequestCooldownDays`
- Produces (from `@/server/social`), with signatures matching today's services so the routes change only their import:
  - `sendFriendRequest(requesterId: string, receiverId: string, now?: Date): Promise<Friendship>`
  - `acceptFriendRequest(targetUserId: string, userId: string): Promise<Friendship>`
  - `declineFriendRequest(targetUserId: string, userId: string): Promise<Friendship>`
  - `removeFriend(targetUserId: string, userId: string): Promise<{ success: boolean }>`
  - `listFriends(userId: string): Promise<FriendProfile[]>`
  - `listFriendRequests(userId: string): Promise<FriendProfile[]>`
  - `getFriendRecords(userId: string, friendId: string): Promise<PersonalRecord[]>`
  - `getAcceptedFriendIds(userId: string): Promise<string[]>`
  - `buildFriendshipPairKey(a: string, b: string): string`
  - Events `"friendship.requested"` and `"friendship.accepted"`: `{ friendshipId: string; requesterId: string; receiverId: string }`
- Produces (client): `getFriendRecords(friendId: string): Promise<PersonalRecord[]>` in `api-client/friends.ts`

- [ ] **Step 1: Write the failing rules unit tests**

`friendship.rules.test.ts` covers `checkFriendshipTransition(action, friendship, actorId, now, cooldownDays)`, which returns `"ok" | "wrongState" | "notAllowed" | "coolingDown"`:
```ts
const DAY = 86_400_000;
const declined = { requesterId: "a", receiverId: "b", status: "declined" as const, updatedAt: new Date(0) };
it.each([
  ["accept by receiver", "accept", pending, "b", "ok"],
  ["accept by requester", "accept", pending, "a", "notAllowed"],
  ["accept when accepted", "accept", accepted, "b", "wrongState"],
  ["decline by receiver", "decline", pending, "b", "ok"],
  ["remove pending by either", "remove", pending, "a", "ok"],
  ["remove accepted by stranger", "remove", accepted, "c", "notAllowed"],
  ["remove declined", "remove", declined, "a", "wrongState"],
])("%s", (_name, action, friendship, actor, verdict) => { /* expect(check(...)).toBe(verdict) */ });

it("reopen by the declined requester inside the cooldown is coolingDown", () =>
  expect(checkFriendshipTransition("reopen", declined, "a", new Date(7 * DAY - 1), 7)).toBe("coolingDown"));
it("reopen by the declined requester at exactly 7 days is ok", () =>
  expect(checkFriendshipTransition("reopen", declined, "a", new Date(7 * DAY), 7)).toBe("ok"));
it("reopen by the decliner inside the cooldown is ok", () =>
  expect(checkFriendshipTransition("reopen", declined, "b", new Date(1), 7)).toBe("ok"));
```
Also cover `validateFriendRequest`: empty ids and self-request throw `DomainError("invalid", …)`, ported from `friend-rules.test.ts`.

- [ ] **Step 2: Write the failing integration tests in `social.test.ts`**

Port every case from `friends.test.ts`. Replace the SSE spy assertions with outbox assertions: send → one `friendship.requested` row with the right payload; accept → one `friendship.accepted` row. Then add:
- Re-send by the declined requester within 7 days → `ConflictError("Friend request already sent.")`, no new outbox row, document still `declined`.
- The decliner sends within 7 days → `pending` with `requesterId` = the decliner, plus a `friendship.requested` row.
- The declined requester sends with `now` 7 days after the decline → `pending`.
- `removeFriend` on a declined pair by the declined requester → `NotFoundError("Friendship not found.")`, and the document still exists.
- `listFriends` returns profiles sorted by level desc with no `personalRecords` key, and skips a friend whose `user` document was deleted.
- `listFriendRequests` is sorted newest first and skips a deleted requester.
- `getFriendRecords` returns the friend's records for an accepted pair, and throws `NotFoundError("Friend not found.")` for a stranger, a pending pair and a declined pair.
- `getAcceptedFriendIds` excludes pending and declined pairs.

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/server/social`
Expected: FAIL (module missing)

- [ ] **Step 4: Implement the module**

- **`friendship.rules.ts`:** holds `FRIENDSHIP_TRANSITIONS` (the spec table), `checkFriendshipTransition`, `validateFriendRequest` and `buildFriendshipPairKey`. The cooldown compares `now - updatedAt` with `cooldownDays × 86_400_000`; at exactly the boundary is `ok`.
- **`friendship.repository.ts`:** every function takes the actor's id and filters on `pairKey` or on `requesterId`/`receiverId`, never `_id` alone (spec "Scoping"). It holds:
  - `findPair(actorId, otherId, session?)`;
  - `reopenOrInsertRequest(requesterId, receiverId, now, session)`, today's upsert;
  - `setStatus(actorId, otherId, status, now, session?)`, filtered by `pairKey`;
  - `deletePair(actorId, otherId)`;
  - `findAccepted(userId)`, limit `MAX_FIND_LIMIT`;
  - `findIncomingPending(userId)`.
- **Send:**
  1. Validate the input.
  2. `getAccounts([receiverId, requesterId])`: a missing receiver is `NotFoundError("User not found.")`, a missing requester is `NotFoundError("Requester not found.")`.
  3. Read the pair. If it's declined, `checkFriendshipTransition("reopen", …)`; `coolingDown` throws `ConflictError("Friend request already sent.")`.
  4. In a transaction: `reopenOrInsertRequest`, then `emit("friendship.requested")`. A duplicate `pairKey` throws `ConflictError("Friend request already sent.")`.
- **Respond (accept and decline):** check the transition and map the verdicts per the spec table. Accept sets the status and emits in one transaction; decline only sets the status.
- **`listFriends` and `listFriendRequests`:** friendships → `getAccounts(ids)` → `getPlayerStates(accounts.map(…))` → join, skip the ids that have no account → sort.
- **`getFriendRecords`:** accepted pair, else `NotFoundError("Friend not found.")`, then `getPersonalRecords(friendId)`.
- **The records route:** `defineRoute({ name: "friends.records", auth: "user", params: idParams }, ({ userId, params }) => getFriendRecords(userId, params.id))`.

- [ ] **Step 5: Switch the modal to lazy records**

`FriendProfileModal` runs `useQuery({ queryKey: ["friends", friend.userId, "records"], queryFn: () => getFriendRecords(friend.userId) })` while mounted. While loading, it renders three fixed-height skeleton rows (`bg-border animate-pulse`, with `motion-reduce:animate-none`); then the existing list or empty state.

- [ ] **Step 6: Run the affected tests, typecheck, lint and the graph check**

Run: `npx vitest run src/server/social src/app/api && npm run typecheck && npx eslint src/server/social src/app/api/friends src/components/friends src/lib/services/friends && npx depcruise src --config .dependency-cruiser.cjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A src/server/social src/app/api/friends src/app/api/cron src/lib src/components/friends
git commit -m "feat(social): social module with transition table, batched loading, decline cooldown and lazy friend records"
```

---

### Task 4: notification module and routes

**Layer:** service + data + route. **Group:** B (with Task 5: disjoint files, and both only consume Task 1's contract).

**Files:**
- Create: `src/server/notification/{index.ts, notification.repository.ts, listeners.ts, list-notifications.ts, mark-notifications-read.ts}`
- Create: `src/server/notification/__tests__/notification.test.ts`
- Create: `src/app/api/notifications/route.ts`, `src/app/api/notifications/read/route.ts`
- Modify: `src/server/runtime.ts` (`LISTENERS = [...achievementListeners, ...notificationListeners]`, removing the adapter)
- Modify: `src/app/api/cron/__tests__/outbox-sweep.test.ts` (assert notification rows; drop the `sse-publisher` mock)
- Delete: `src/lib/services/friends/notify-friends-level-up.ts` (the `src/lib/sse` files stay until Task 6, because the SSE route still imports the publisher)

**Interfaces:**
- Consumes: `getAcceptedFriendIds` from `@/server/social`; `getAccount` from `@/server/platform/auth`; `NotificationDoc`, `Notification`, `NotificationsQuerySchema`, `MarkNotificationsReadSchema` (Task 1); the events from Tasks 2 and 3, plus `progression.leveled-up`
- Produces (from `@/server/notification`):
  - `notificationListeners: AnyListener[]`
  - `listNotifications(userId: string, since?: Date): Promise<{ items: Notification[]; unreadCount: number }>`
  - `markNotificationsRead(userId: string, input: MarkNotificationsReadInput, now?: Date): Promise<{ unreadCount: number }>`
- Routes: `GET /api/notifications` (`notifications.list`), `PATCH /api/notifications/read` (`notifications.read`, `throttle: "standard"`, `body: MarkNotificationsReadSchema`)

- [ ] **Step 1: Write the failing tests in `notification.test.ts`**

Drive each listener through a real dispatcher: `createDispatcher(notificationListeners)` plus `emit` inside a transaction (see `src/testing/transactions.ts`), then `dispatchOwnAndOverdue([id])`.
- `friendship.requested` → one row for the receiver: `type: "friend.requested"`, `actor.name` equal to the requester's name, `data.friendshipId`, `readAt: null`.
- `friendship.accepted` → one row for the requester, with the receiver as actor.
- `progression.leveled-up` with accepted, pending and declined pairs → rows only for the accepted friends, with `data.newLevel`; a user with no friends → 0 rows.
- `achievement.unlocked` → one row for the user, `actor: null`, `data.achievementId`.
- The same event delivered twice (`npm run outbox`-style requeue: reset `status`, `completedListeners`) → still one row per recipient.
- `listNotifications` without `since` → latest 20 of 25, newest first. With `since` = the 3rd newest `createdAt` → 3 rows, `$gte` inclusive. `unreadCount` counts only `readAt: null`.
- `markNotificationsRead` by ids marks only the caller's rows, ignoring another user's id; `{ all: true }` → `unreadCount: 0`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/server/notification`
Expected: FAIL

- [ ] **Step 3: Implement the module and routes**

- **`notification.repository.ts`:**
  - `upsertForRecipients(rows: Omit<NotificationDoc, "_id">[]): Promise<void>` is one `bulkWrite` of `updateOne({ userId, sourceEventId }, { $setOnInsert: row }, { upsert: true })`. It is the one cross-user write, and every filter carries the recipient's `userId`.
  - `findFeed`, `countUnread` and `markRead` go through `userScopedRepository<NotificationDoc>("notifications")`. Mark-read filters `readAt: null` and ignores ids that `parseObjectId` rejects.
- **`listeners.ts`:** each `handle(payload, { eventId })` reads the actor via `getAccount` (a missing actor gives `actor: null`) and writes with `sourceEventId: eventId` and `createdAt: new Date()`. Wire the names from the Global Constraints.
- **`list-notifications.ts`:** maps documents to the wire type (`id`, ISO dates, no `sourceEventId`).
- **Routes:** `GET` parses `query: NotificationsQuerySchema` and passes `since && new Date(since)`. `PATCH` returns `markNotificationsRead`'s result.
- **`outbox-sweep.test.ts`:**
  - The first sweep still delivers 3.
  - Assert `notifications` has exactly one `friend.leveled-up` row for `friendId` with `data.newLevel: 2`, and one `achievement.unlocked` row for `userId`.
  - The second sweep delivers 0, and the counts stay the same.
  - Clean up `notifications` in `afterEach`.

- [ ] **Step 4: Run the affected tests, typecheck, lint and the graph check**

Run: `npx vitest run src/server/notification src/app/api && npm run typecheck && npx eslint src/server/notification src/server/runtime.ts src/app/api/notifications && npx depcruise src --config .dependency-cruiser.cjs`
Expected: PASS (the route-table test covers the new PATCH)

- [ ] **Step 5: Commit**

```bash
git add -A src/server/notification src/server/runtime.ts src/app/api src/lib/services
git commit -m "feat(notification): notification inbox written by outbox listeners, with list and mark-read routes"
```

---

### Task 5: client feed logic

**Layer:** client data. **Group:** B (with Task 4).

**Files:**
- Create: `src/lib/notifications/constants.ts`, `src/lib/notifications/notification-feed.ts`, `src/lib/notifications/useNotifications.ts`
- Create: `src/lib/notifications/__tests__/notification-feed.test.ts`
- Create: `src/lib/data/api-client/notifications.ts`; Modify: `src/lib/data/api-client/index.ts`

**Interfaces:**
- Consumes: `Notification`, `MarkNotificationsReadInput` (Task 1); `apiFetch`
- Produces:
  - `getNotifications(since?: string): Promise<{ items: Notification[]; unreadCount: number }>`, `markNotificationsRead(input: MarkNotificationsReadInput): Promise<{ unreadCount: number }>`
  - `mergeFeed(existing: Notification[], incoming: Notification[], limit: number): Notification[]` (dedupe by `id`, keep the incoming version, newest `createdAt` first, cap)
  - `selectToastBatch(incoming: Notification[], window: { loadedAt: number; visibleSince: number }): Notification[]` (`createdAt` strictly later than both)
  - `nextPollInterval(now: number, fastUntil: number): number`
  - `extendFastWindow(now: number): number` (returns `now + FAST_POLL_WINDOW_MS`; the caller stores the max)
  - `useNotifications(): { items: Notification[]; unreadCount: number; toastBatch: Notification[]; clearToast(): void; markRead(ids: string[]): void; markAllRead(): void }`

- [ ] **Step 1: Write the failing unit tests**

```ts
it("mergeFeed drops a duplicate id returned again by an inclusive since", () =>
  expect(mergeFeed([n("a", 3)], [n("a", 3), n("b", 4)], 50).map((x) => x.id)).toEqual(["b", "a"]));
it("mergeFeed keeps the newest 50", () => expect(mergeFeed(many(40), many(20, 100), 50)).toHaveLength(50));
it("mergeFeed takes the incoming copy so readAt updates", () => /* readAt from incoming */);
it("selectToastBatch ignores entries from before the tab became visible", () =>
  expect(selectToastBatch([n("a", 5), n("b", 15)], { loadedAt: 0, visibleSince: 10 }).map((x) => x.id)).toEqual(["b"]));
it("selectToastBatch ignores the first load", () =>
  expect(selectToastBatch([n("a", 5)], { loadedAt: 5, visibleSince: 0 })).toEqual([]));
it("nextPollInterval is 2 s inside the window and 30 s after it", () => {
  expect(nextPollInterval(1_000, 5_000)).toBe(2_000);
  expect(nextPollInterval(5_000, 5_000)).toBe(30_000);
});
it("extendFastWindow moves the deadline instead of stacking", () => expect(extendFastWindow(3_000)).toBe(13_000));
```
`n(id, createdAtMs)` builds a `friend.leveled-up` `Notification`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/notifications`
Expected: FAIL

- [ ] **Step 3: Implement the functions, the api-client and the hook**

`useNotifications`:
- **Query:** `useQuery<{ items: Notification[]; unreadCount: number }>` with `queryKey: ["notifications"]`. The query function sends `since` = the cached newest `createdAt`, merges with `mergeFeed`, and records the toast batch.
- **Polling:** `refetchInterval: () => nextPollInterval(Date.now(), fastUntilRef.current)`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: true`, `staleTime: 0`.
- **Visibility:** a `visibilitychange` listener sets `visibleSince` when the tab becomes visible; `loadedAt` is set after the first successful fetch.
- **Fast window:** `queryClient.getMutationCache().subscribe(...)`. On a mutation that succeeded and whose `mutationKey?.[0] !== "notifications"`, set `fastUntilRef.current = Math.max(fastUntilRef.current, extendFastWindow(Date.now()))` and refetch. The required comment, one line above the subscription:
  `// Listeners run in after(), so an immediate refetch can miss the entry; a bounded fast window is a known compromise (Known Issues: fast-poll window).`
- **Friend data:** new `friend.*` items invalidate `["friends"]`.
- **Mutations:** `markRead` and `markAllRead` are `useMutation` calls with `mutationKey: ["notifications", "read"]`. They update the cache optimistically and set `unreadCount` from the response.

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run src/lib/notifications && npm run typecheck && npx eslint src/lib/notifications src/lib/data/api-client`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications src/lib/data/api-client
git commit -m "feat(notification): client feed merge, toast selection and polling hook with fast window"
```

---

### Task 6: Bell, panel and toast; SSE retired

**Layer:** component + page. **Group:** none.

**Files:**
- Create: `src/components/notifications/{NotificationBell.tsx, NotificationPanel.tsx, NotificationToast.tsx, NotificationCenter.tsx}`
- Modify: `src/app/(app)/layout.tsx` (mount `NotificationCenter`; remove `AchievementManager` and `FriendEventManager`), `src/components/layout/sidebar/SidebarUserProfile.tsx` or `Sidebar.tsx` (desktop bell beside the profile block), `src/app/(app)/friends/page.tsx` (drop `useFriendEvents` and the "Reconnecting feed" indicator)
- Delete: `src/components/notifications/{FriendEventManager,FriendToast,AchievementManager,AchievementToast}.tsx`, `src/lib/hooks/useFriendEvents.ts`, `src/app/api/friends/events/route.ts`, all of `src/lib/sse/` (`sse-publisher.ts`, `friend-event-stream.ts`, `sse-registry.ts`, `sse-types.ts`, and both tests under `__tests__/`)
- Modify: `vault/checklist/Known Issues.md`: delete #1; in #2, update the paths to `src/server/training/exercises/create-custom-exercise.ts` and `src/server/social/send-friend-request.ts`; add "Notification fast-poll window is a timing heuristic", with the spec's D-5 candidates and the hook path

**Interfaces:**
- Consumes: `useNotifications()` (Task 5); `ACHIEVEMENT_DEFINITIONS` from `@/shared/achievement-definitions`; `AchievementIconMap`; `UserAvatar`

- [ ] **Step 1: Build the components to the spec's UI section and critique table**

- **`NotificationBell`:** takes `{ unreadCount, onOpen, expanded }`.
- **`NotificationPanel`:** a desktop popover and a mobile `<dialog>` sheet, with the row text table, "Mark all read", the "You're all caught up" empty state, and row click → `markRead([id])` + `router.push` (`/friends` or `/profile`).
- **`NotificationToast`:** the single toast, or the "N new notifications" toast that opens the panel. Transitions only `transform` and `opacity`, with a timer that pauses on hover and while hidden.
- **`NotificationCenter`:**
  - calls the hook;
  - renders the mobile bell (`fixed`, safe-area top, `lg:hidden`) and the toast;
  - sets `document.title` to `(${n}) ${baseTitle}` when `n > 0`, restoring the original title on unmount.
- **Sidebar:** the desktop bell reads the same hook. React Query dedupes, so one query is shared.
- **Styling:** use the exact easing and durations from the critique table, lucide icons and tokens only, and no `style={{}}`. Where a class list runs long, use a small module-local `const` map.

- [ ] **Step 2: Remove the SSE path and old managers, then verify nothing references them**

Run: `grep -rn "sse\|useFriendEvents\|FriendEventManager\|AchievementManager\|friends/events" src --include=*.ts --include=*.tsx`
Expected: no matches

- [ ] **Step 3: Typecheck, lint, full suite, graph check**

Run: `npm run typecheck && npx eslint src/components/notifications src/components/layout "src/app/(app)" && npm run test:run && npx depcruise src --config .dependency-cruiser.cjs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A src/components src/app src/lib vault/checklist
git commit -m "feat(notification): notification bell, panel and single live toast; retire SSE friend feed"
```

---

## Parallel groups

- **Group B (Tasks 4 and 5):** Task 4 writes `src/server/notification`, the notification routes, `runtime.ts`, `outbox-sweep.test.ts` and old `lib` deletions. Task 5 writes only `src/lib/notifications` and `src/lib/data/api-client`. Both consume only Task 1's contract.

Tasks 1 → 2 → 3 form a chain (2 and 3 both edit `outbox-sweep.test.ts`), and Task 6 needs both 4 and 5.

[[Plans Index]]
