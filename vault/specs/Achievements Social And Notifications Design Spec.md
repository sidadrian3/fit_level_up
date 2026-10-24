# Achievements Social And Notifications Design Spec

**Status:** Approved, 2026-10-25, after a brainstorm and grilling pass. Steps 3.6, 3.7 and 3.8 in [[Architecture Overhaul Audit]], shipped together on one branch. Implements C4 (the achievement and friendship events), C7 (the notification document and routes), D1 (polling, not SSE) and G5 of [[Architecture Overhaul Design Spec]], with the amendments listed under Decisions. Type full-stack. Design critique (Step 3.5): ran, and its changes are folded into the UI section.

Read spec C4, C5, C7 and C9 first. This spec restates only what the build needs beyond them.

## Problem Statement

- **Achievements** are evaluated by an old `src/lib` service wired into `runtime.ts` as an adapter, and `training` imports the achievements data file for the dashboard count. Nothing announces an unlock, so the browser finds new badges by re-downloading the whole achievement list on every user change (`AchievementManager`).
- **Friends** run one query set per friend: `getFriends` makes 7 lookups per friend, and 4 of them compute personal records the list never shows. `getFriendRequests` makes 3 per request. Status rules are `if` checks repeated across four services. A declined requester can re-send without limit ([[Known Issues]] #1), and can also bypass any future limit by deleting the declined pair and sending again.
- **Notifications** are a Redis list per user with a 60-second TTL, popped by an SSE route that polls Upstash every 5 seconds per open tab. Reads are destructive, so a second tab or an offline user loses the event.

## Solution

Three modules under `src/server`, connected only by outbox events:

```
training ──activity.logged──────────┐
progression ──progression.leveled-up─┼─► achievements ──achievement.unlocked──┐
                                     │                                         ├─► notification ──► notifications collection
social ──friendship.requested/accepted─────────────────────────────────────────┘        ▲
progression ──progression.leveled-up────────────────────────────────────────────────────┘
                                                                     browser polls GET /api/notifications
```

- **achievements** evaluates on `activity.logged` and `progression.leveled-up`. It writes unlocks and emits `achievement.unlocked` in one transaction.
- **social** owns friendships: a transition table, batched profile loading, lazy personal records behind a friendship check, a decline cooldown, and the two friendship events.
- **notification** is listener-only. Each listener writes inbox rows (a fan-out on write), and two routes serve them. The browser polls, and a bell in the layout shows the feed.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | **Friends' personal records load lazily.** `GET /api/friends` drops `personalRecords`. A new `GET /api/friends/[id]/records` returns one friend's records and answers 404 unless the pair is `accepted`. **Amends** the audit's "preserved: friend API responses" | Records appear only in `FriendProfileModal`. Computing them for every friend on every visit cost 4 queries per friend. The list becomes 3 queries whatever the friend count; opening a friend costs 5 |
| 2 | **The re-request cooldown binds only the declined person.** Within `GAME_CONFIG.social.friendRequestCooldownDays` (7) of a decline, the previous requester's re-send answers `409 "Friend request already sent."`, the same as a pending duplicate. The previous receiver (the decliner) may send at any time, which reopens the pair with the roles swapped | Declining stays silent: the response leaks nothing. The decliner changing their mind is not spam, and a decline back locks them in turn. Settles [[Known Issues]] #1 |
| 3 | The cooldown reads the declined document's `updatedAt` | Only the decline writes a declined document, so `updatedAt` is the decline time. No new field, no migration |
| 4 | **Removing a declined pair is refused as `404 "Friendship not found."`.** Remove is allowed from `pending` (either participant: cancel or dismiss) and `accepted` | Today a declined requester can `DELETE` the pair and send a fresh request, which bypasses any cooldown. 404 keeps the decline silent |
| 5 | **After the user's own successful mutation, the bell polls every 2 s for up to 10 s.** A further mutation extends the deadline; it never starts a second poller. Afterwards polling returns to 30 s | The achievement and notification listeners run in `after()`, so the immediate refetch usually lands before the entry exists. A bounded window tolerates slow listeners, where one delayed refetch would be a guess. This is a known compromise: a code comment and [[Known Issues]] record it with better candidates (D-5 below) |
| 6 | **At most one toast, and only for entries that arrive while the tab is visible.** An entry toasts only if its `createdAt` is later than both the first load and the moment the tab last became visible. Several new entries collapse into one "N new notifications" toast that opens the bell | Returning to the app after a day (or to the tab after a while) must not stack toasts. The badge and the tab title carry the catch-up |
| 7 | **Request notifications are not touched when the request is acted on.** They stay unread until the bell opens a row or "Mark all read" | The user acted on it and knows. Clearing it would need a `friendship.declined` event and a listener for no real gain |
| 8 | **Achievement definitions move to `src/shared/achievement-definitions.ts`.** The achievements module imports them from there, and the bell uses them to render an unlock row | The bell runs in the browser and needs the title and icon. Notification may not import achievements (G5), and C4 keeps display data out of event payloads. The definitions are static content the profile page already shows |
| 9 | **The dashboard's achievement count is injected.** `getDashboardStats` takes `countAchievements: (userId) => Promise<number>`, and its three callers (stats route, dashboard page, profile page) pass `countUnlockedAchievements` from `@/server/achievements` | Training may not import achievements (G5). This follows step 3.5's precedent of callbacks passed in (`ActivityDays`, `QuestMeasure`) |
| 10 | **Friend fan-out reads friend ids from social's public API.** Notification imports `@/server/social` (`getAcceptedFriendIds`); social imports nothing from notification | G5 only restricts who imports notification. The graph stays acyclic: notification → social → progression |
| 11 | **Listener names are kept:** `achievements.evaluate` and `notification.friend-leveled-up` | Outbox rows pending across the deploy record completed listeners by name. Renaming would rerun completed work on those rows |
| 12 | **Achievement unlocks are evaluated against `getPlayerState`**, the same display streak, level and totals the old `getUser` path used | Preserves every unlock outcome |
| 13 | A partial index on unread rows, `{ userId: 1 }` with `partialFilterExpression: { readAt: { $type: "null" } }`, backs the unread count. **Adds** to C7's index table | The count runs on every poll. Without it, it scans the user's full 90 days of rows |
| 14 | Clicking a bell row marks that one entry read and navigates: friend entries to `/friends`, achievement entries to `/profile`. Opening the panel marks nothing | Reading the list is not acting on it. Matches the agreed behaviour |
| 15 | The tab title shows the unread count as a prefix: `(3) FitLevelUp` | Visible from another tab without any permission prompt |

### D-5: why the fast-poll window, and what could replace it

The window is sleep-based synchronisation with a ceiling: it bets that the listener finishes within 10 s. It is cheap (at most one request per 2 s per tab, only after the user's own actions) and fails soft: a miss falls back to the 30 s poll. Better options, deferred:

- **Server hands the client what to wait for.** The mutation response carries the emitted event ids, and the client polls a status endpoint until they are processed. Exact, but new machinery on every mutation route.
- **Push delivery** (D1's scale exit: Pusher, Ably). Removes polling entirely.

## Contract

### Server modules and files

```
src/shared/
  achievement-definitions.ts      ACHIEVEMENT_DEFINITIONS, AchievementCondition, AchievementRarity (moved from server/achievements)
  contracts/notification.ts       Notification wire type, NotificationsQuerySchema, MarkNotificationsReadSchema

src/server/achievements/
  index.ts                        achievementListeners, listAchievements, countUnlockedAchievements, ACHIEVEMENT_DEFINITIONS (re-export)
  events.ts                       "achievement.unlocked": { userId; achievementId }
  achievement.rules.ts            pure: isConditionMet(condition, stats), findNewUnlocks(definitions, unlockedIds, stats)
  achievement.repository.ts       user-scoped: findUnlocks, upsertUnlocks (returns ids actually inserted), countUnlocks
  evaluate-achievements.ts        listener use case: player state → rules → upsert + emit, one transaction
  list-achievements.ts            definitions joined with unlocks (the GET /api/achievements shape)

src/server/social/
  index.ts                        sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
                                  listFriends, listFriendRequests, getFriendRecords, getAcceptedFriendIds
  events.ts                       "friendship.requested" | "friendship.accepted": { friendshipId; requesterId; receiverId }
  friendship.rules.ts             pure: FRIENDSHIP_TRANSITIONS, checkFriendshipTransition, buildFriendshipPairKey, validateFriendRequest
  friendship.repository.ts        participant-scoped queries (see "Scoping" below)
  send-friend-request.ts  respond-to-request.ts  remove-friend.ts
  list-friends.ts                 friends and incoming requests, batched
  get-friend-records.ts           friendship check → training.getPersonalRecords

src/server/notification/
  index.ts                        notificationListeners, listNotifications, markNotificationsRead
  notification.repository.ts      upsertForRecipients (bulk, keyed by userId + sourceEventId), findFeed, countUnread, markRead
  listeners.ts                    friend-requested, friend-accepted, friend-leveled-up, achievement-unlocked
  list-notifications.ts  mark-notifications-read.ts
```

File names inside a module are the builder's call, as long as each module keeps one `index.ts`. `accept` and `decline` may share one file because they differ only in the transition and the event.

**New public functions on existing modules:**

| Module | Function | Why |
|---|---|---|
| `platform/auth` | `getAccounts(userIds: string[]): Promise<Account[]>`, one `$in` query, skipping ids that are not valid ObjectIds or don't exist | Batched friend and request loading |
| `progression` | `getPlayerStates(entries: { userId; timeZone }[], { now }): Promise<Map<string, PlayerState>>`, one `$in` query on `player_profiles`, with defaults for a user with no profile | Same; the caller already holds each time zone from `getAccounts` |

**Scoping.** `friendships` has no `userId` field, so it cannot use `userScopedRepository`. Every repository function takes the acting user's id and filters on it: by `pairKey` built from the actor and the target, or by `requesterId`/`receiverId` equal to the actor. No function looks up a friendship by `_id` alone. `notification.repository.ts` uses `userScopedRepository` for reads and mark-read. The fan-out write is the one cross-user write, keyed by each recipient's `userId`.

### Transition table

```ts
// friendship.rules.ts
export const FRIENDSHIP_TRANSITIONS = {
  accept:  { from: ["pending"],             actor: "receiver" },
  decline: { from: ["pending"],             actor: "receiver" },
  remove:  { from: ["pending", "accepted"], actor: "participant" },
  reopen:  { from: ["declined"],            actor: "previousReceiver | requesterAfterCooldown" },
} as const;
```

`checkFriendshipTransition(action, friendship, actorId, now, cooldownDays)` returns a verdict: `ok`, `wrongState`, `notAllowed` or `coolingDown`. The services map verdicts to errors. This keeps the rules free of `platform/http`, and lets one verdict map to different errors per action:

| Action | `wrongState` | `notAllowed` | `coolingDown` |
|---|---|---|---|
| accept, decline | `409 "Friend request is not pending."` | `403 "Not authorized to respond to this request."` | — |
| remove | `404 "Friendship not found."` (keeps a decline silent) | `403` | — |
| reopen (inside send) | — | — | `409 "Friend request already sent."` |

Send keeps today's other outcomes: self-request 400, unknown receiver 404, an existing pending or accepted pair 409 `"Friend request already sent."`. A reopen that is allowed resets `requesterId`, `receiverId`, `status: "pending"`, `createdAt` and `updatedAt`, as the current upsert does.

### Events

Each emit runs in the same transaction as the write it reports:

| Event | Emitted by | When |
|---|---|---|
| `achievement.unlocked` | achievements | once per newly inserted unlock (`upsertedIds`), so a concurrent evaluation never emits twice |
| `friendship.requested` | social | send, including an allowed reopen |
| `friendship.accepted` | social | accept |

Decline and remove emit nothing.

### Listeners (`runtime.ts`)

```ts
export const LISTENERS = [...achievementListeners, ...notificationListeners];
```

| Listener | Event | Writes |
|---|---|---|
| `achievements.evaluate` | `activity.logged`, `progression.leveled-up` | unlocks + `achievement.unlocked` |
| `notification.friend-requested` | `friendship.requested` | one row to the receiver, actor = requester |
| `notification.friend-accepted` | `friendship.accepted` | one row to the requester, actor = receiver |
| `notification.friend-leveled-up` | `progression.leveled-up` | one row per accepted friend, actor = the user, `data.newLevel` |
| `notification.achievement-unlocked` | `achievement.unlocked` | one row to the user, actor `null`, `data.achievementId` |

Every notification write is an upsert with `$setOnInsert` on `(userId, sourceEventId = meta.eventId)`. The actor's name and avatar come from `getAccount` when the listener runs (C7 snapshot). A missing actor account means a `null` actor, not a failure, and a level-up from a user with no friends writes nothing.

### `notifications` collection

C7's document and indexes, plus Decision 13's unread index, plus a `$jsonSchema` validator in `schema.ts`. `applySchema` creates the collection at build, so no numbered migration is needed.

### Routes

| Route | Contract |
|---|---|
| `GET /api/notifications?since=<ISO>` | `name: "notifications.list"`, `auth: "user"`, query `NotificationsQuerySchema` (`since` optional, an ISO datetime). `200 { items: Notification[]; unreadCount: number }`: with `since`, rows with `createdAt >= since`, newest first, at most 50; without it, the latest 20 |
| `PATCH /api/notifications/read` | `name: "notifications.read"`, `auth: "user"`, `throttle: "standard"`, body `{ ids: string[] }` (1–50 ids) or `{ all: true }`. `200 { unreadCount: number }`. Ids that are not the user's or don't exist are ignored |
| `GET /api/friends/[id]/records` | `name: "friends.records"`, `auth: "user"`, `params: idParams`. `200 PersonalRecord[]`; `404 "Friend not found."` unless the pair is accepted |
| `GET /api/friends` | Unchanged except that entries have no `personalRecords`. Sort: level descending |
| `GET /api/friends/requests` | Unchanged except that entries have no `personalRecords`. Sort: newest request first |
| `GET /api/friends/events` | **Deleted** |
| Other friend routes, `GET /api/achievements` | Unchanged responses |

**Wire type** (`src/shared/contracts/notification.ts`): the C7 union with `_id` as `id: string`, `sourceEventId` omitted, and dates as ISO strings.

```ts
export type Notification = {
  id: string;
  actor: { userId: string; name: string; avatar: string } | null;
  createdAt: string;
  readAt: string | null;
} & (
  | { type: "friend.requested" | "friend.accepted"; data: { friendshipId: string } }
  | { type: "friend.leveled-up"; data: { newLevel: number } }
  | { type: "achievement.unlocked"; data: { achievementId: string } }
);
```

`FriendProfile` in `src/lib/types.ts` loses `personalRecords`.

## UI

### Data layer (`src/lib/notifications/`)

- `constants.ts`:
  - `NOTIFICATION_POLL_INTERVAL_MS = 30_000`
  - `FAST_POLL_INTERVAL_MS = 2_000`
  - `FAST_POLL_WINDOW_MS = 10_000`
- `useNotifications()` owns the query key `["notifications"]`:
  - **Fetching:** `refetchInterval` is 2 s inside the fast window and 30 s otherwise, with `refetchIntervalInBackground: false` and `refetchOnWindowFocus: true`.
  - **Merging:** the query function sends `since` = the newest `createdAt` it holds, merges the result by `id`, keeps the newest 50 and takes `unreadCount` from the response.
  - **Fast window:** the hook subscribes to the `MutationCache`. A successful mutation outside the `["notifications", …]` mutation keys moves the deadline to now + 10 s and refetches once. This is where the Decision 5 comment lives.
  - **Toasts:** it exposes `items`, `unreadCount`, `markRead(ids)`, `markAllRead()` and the batch of new entries to toast, per Decision 6.
  - **Friend data:** when new `friend.*` entries arrive, it invalidates `["friends"]`, the job `useFriendEvents` did.
- `src/lib/data/api-client/notifications.ts`: `getNotifications(since?)`, `markNotificationsRead(body)`, and `getFriendRecords(id)` in `friends.ts`.

### Components

| Component | Where | Behaviour |
|---|---|---|
| `NotificationBell` | Desktop: in the sidebar, beside the user profile block. Mobile: fixed top-right, above page content | Bell icon with an unread badge (hidden at 0, "9+" above 9). Opens the panel |
| `NotificationPanel` | Desktop: popover anchored to the bell. Mobile: full-width sheet | Rows newest first: actor avatar (or the achievement icon), one line of text, relative time, an unread dot. "Mark all read" in the header. Empty state: "You're all caught up". A row click marks it read and navigates (Decision 14) |
| `NotificationToast` | Bottom-right, where the friend and achievement toasts sat | One toast, 5 s, dismissible. Text for one entry, or "N new notifications" that opens the bell. Replaces `FriendToast` and `AchievementToast` |
| `NotificationCenter` | Mounted once in `app/(app)/layout.tsx` | Calls `useNotifications`, renders the toast, sets the tab title (Decision 15) |
| `FriendProfileModal` | Existing | Fetches `["friends", id, "records"]` while open. Skeleton rows while loading; the existing empty state when there are none |

**Row text:**

| Type | Text |
|---|---|
| `friend.requested` | "{name} sent you a friend request" |
| `friend.accepted` | "{name} accepted your friend request" |
| `friend.leveled-up` | "{name} reached Level {newLevel}" |
| `achievement.unlocked` | "Achievement unlocked: {title}" (title and icon from the shared definitions; an unknown id shows "Achievement unlocked") |

`LevelUpManager` (your own level-up) stays as it is.

### Design critique (Step 3.5)

`emil-design-eng`, `ui-ux-pro-max`, `ui-styling` and `design-taste-frontend` ran against this section, fitted to [[UI Overhaul Design Spec]] and the tokens in `globals.css`. The changes they settled:

| Before | After | Why |
| --- | --- | --- |
| Panel open/close unspecified | Desktop popover: `opacity` + `scale(0.97 → 1)`, 180 ms, `cubic-bezier(0.23, 1, 0.32, 1)`, `transform-origin` at the bell. Mobile sheet: `translateY(100%) → 0`, 280 ms, `cubic-bezier(0.32, 0.72, 0, 1)`. Exit is faster than entry (150 ms) | Opened a few times a day: a short ease-out confirms the trigger without slowing the user. It scales from its anchor, not from centre |
| Existing toasts use `transition-all duration-300` and `animate-bounce` | `NotificationToast` transitions only `transform` and `opacity`: enter `translateY(100%) → 0` at 250 ms ease-out, exit 150 ms. No bounce. The 5 s timer pauses on hover and while the tab is hidden | `all` animates layout properties; a repeating bounce is noise on a recurring element; a hidden tab must not eat the toast |
| Badge animates on every count change | The badge is static when the count changes. It appears with a 150 ms `scale(0.9) → 1` + opacity only when going from 0 to unread | A count seen dozens of times a day should not move each poll |
| Rows unspecified | No stagger and no row entrance animation; the list appears instantly. Mark-read fades the dot in 150 ms | Frequently opened list: stagger would make it feel slow |
| Bell button unspecified | `<button>` with the `active-press` utility, a hit area of at least 44 × 44 px, and hover styles gated behind `(hover: hover)` | Press feedback in the Modern Athletic language; a touch target fit for a thumb |
| Accessibility unspecified | Bell: `aria-label="Notifications, N unread"`, `aria-haspopup="dialog"`, `aria-expanded`. Panel: `role="dialog"` with a label; Escape and outside click close it; focus moves into it on open and returns to the bell on close. Toast: `role="status"` (`aria-live="polite"`). Unread is shown by the dot **and** bolder text plus a visually hidden "unread", not by colour alone | Keyboard and screen-reader parity; WCAG "not colour alone" |
| Mobile bell position | `fixed` top-right inside the safe area (`top-[max(1rem,env(safe-area-inset-top))]`), `lg:hidden`. The sheet uses a native `<dialog>` with a `::backdrop` scrim at about 50 % black | Clears the notch; `<dialog>` gives focus trapping and Escape for free |
| Colour per type unspecified | A small icon chip per row reuses the old toasts' mapping: request `accent-blue`, accepted `accent-green`, level-up and achievement `accent-purple`. The badge is `bg-accent-green text-background` | One semantic colour language across toast, row and badge; lime on black is the brand accent and reads at 4.5:1 |
| Records loading unspecified | `FriendProfileModal` reserves three skeleton rows (`bg-border animate-pulse`, fixed row height) so the modal does not jump when records arrive | No layout shift |
| Reduced motion | Under `prefers-reduced-motion`, the panel, sheet and toast fade only (no translate or scale); skeleton pulse is removed | Fewer, gentler animations, not none |
| Generic patterns to avoid | No glass blur panel, no gradient badge, no emoji icons, no decorative eyebrow labels. Header text is "Notifications" in the app's heading style; the single action is "Mark all read". Icons from `lucide-react`, already in use | Modern Athletic forbids glass; one label per action; one icon family |

No new UI dependency: the panel is a hand-built component (no shadcn, per the audit §7). Long class lists go through a small helper, per AGENTS.md.

### Deleted

| Area | What goes |
|---|---|
| Real time | `src/lib/sse/` (publisher, registry, stream, types and both tests) and `src/app/api/friends/events` |
| Toasts and hooks | `useFriendEvents`, `FriendEventManager`, `FriendToast`, `AchievementManager`, `AchievementToast`, and the friends page's "Reconnecting feed" indicator |
| Old back end | `src/lib/services/friends/`, `src/lib/services/achievements/`, `src/lib/domain/{friend-rules,achievement-rules}.ts` with `friend-rules.test.ts`, and `src/lib/data/{friendships-db,achievements-db}.ts` with `friendships-db.test.ts` |
| Tests that move | `friends.test.ts` and `evaluate-achievements.test.ts` move into the new modules' `__tests__`, rewritten against the new entry points |
| Route table | The `friends.events` entry. `notifications.read` and `friends.records` are added |

## Testing

Integration first, against the in-memory replica set (AGENTS.md):

| Area | Tests |
|---|---|
| achievements | Same unlocks as today for each condition. A concurrent double evaluation inserts once and emits once. An unlock emits `achievement.unlocked` in the same transaction. `GET /api/achievements` unchanged |
| social rules (unit) | Every transition × actor × state verdict, the cooldown boundary (just inside, exactly at, just after 7 days), and decliner reopen within the cooldown |
| social services | Send, accept, decline and remove outcomes and messages as today, plus: re-send within the cooldown → 409 with no event; the decliner reopens → pending with roles swapped and an event; remove on declined → 404; accept and send emit their event. `listFriends` and `listFriendRequests` keep their sort order and fields and skip a deleted account. The records endpoint returns records for a friend and 404 for a stranger, a pending pair or a declined pair |
| notification | Each listener writes the right row to the right recipient. Redelivering the same event writes once. Level-up fans out to accepted friends only. `GET` with and without `since`, limits and `unreadCount`. `PATCH` by ids (another user's ids ignored) and `all` |
| outbox | The existing "kill dispatch then sweep" test now asserts a notification row instead of a mocked Redis publish. A chained `achievement.unlocked` emitted during a drain is delivered by the same drain |
| route table | `notifications.read` carries a throttle and a body schema |

UI: no new unit tests by default (AGENTS.md). Pipeline Step 7b verifies with two throwaway accounts: request, accept, level-up and achievement entries; the badge, panel, toast and tab title; and the lazy records modal.

## Out of Scope

- Accepting or declining a request from inside the panel.
- Browser and OS push notifications.
- Notification preferences and muting.
- Moving query keys for other domains into `lib/<domain>/hooks` (step 4.1).
- Clearing a request notification when it is acted on (Decision 7).

## Risks

- **Fan-out size.** A level-up writes one row per friend in one bulk write. That's fine at this size; a user with thousands of friends would need fan-out on read.
- **`$type: "null"` in a partial index.** Confirm the in-memory server and Atlas accept it. If not, fall back to the feed index plus a bounded count.
- **Old tabs across the deploy** retry the deleted SSE route with a 404 until they reload. This is harmless.
- **Response shape change.** Any client caching `/api/friends` with `personalRecords` breaks only the modal, and the modal changes in the same release.

[[Specs Index]]
