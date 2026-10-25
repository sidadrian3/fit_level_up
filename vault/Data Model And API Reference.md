# Data Model And API Reference

Every MongoDB collection, every API route and every page in FitLevelUp. The code is the source of truth: collection names, document types, indexes and validators come from `src/server/platform/database/schema.ts`, and shared types from `src/lib/types.ts` and `src/shared/contracts/`. This note is kept in step with them by the Handbook Sync step ([[Developer Handbook]] §7).

---

## 1. Conventions

- Every document that belongs to a person carries a `userId`, and every query filters on it. The `userId` comes from the session (`defineRoute({ auth: "user" })` hands it to the handler), never from the request.
- Dates are stored as BSON `Date` and returned to the browser as ISO strings (`DateString`).
- Creates that a retry could repeat (workouts, runs, templates) take a client-generated UUID in the `Idempotency-Key` header, stored on the document as `idempotencyKey` next to `idempotencyFingerprint` (a SHA-256 of the validated body) and backed by a unique partial index. A retry with the same key and body replays the stored entity; the same key with a different body is a `422`.
- Collection names are fixed in `COLLECTIONS` in `schema.ts`; no environment variable overrides them.

## 2. Collections

| Collection | Default name | Holds | Owner field |
|---|---|---|---|
| Users | `user` | The Better Auth identity only: `email`, `name`, `avatar` (or `image`), `createdAt`, `timeZone`. Game fields written before step 3.1 (`level`, `xp`, `xpToNextLevel`, `streak`, `lastActivityDate`, `totalWorkouts`, `totalDistance`, `stamina`, `lastStaminaUpdate`, `__v`) may still sit on old documents; nothing reads or writes them | `_id` |
| Player profiles | `player_profiles` | One document per player, `_id` is the user id string: `totalXp` (cache of the ledger sum), `highestLevel` (the highest level ever reached; only a level above it counts as a level-up), `streak`, `lastActivityDay` (`YYYY-MM-DD` in the user's zone, or `null`), `stamina`, `lastStaminaUpdate`, `totalWorkouts`, `totalDistance` (km), `createdAt`, `updatedAt`. Level, in-level XP and `xpToNextLevel` are computed from `totalXp`, never stored. Created by the first write; reads of a missing profile return defaults | `_id` |
| XP ledger | `xp_ledger` | One row per XP grant: `sourceType` (`workout`, `run`, `quest_claim`), `sourceId`, `amount`, `occurredAt`, `createdAt`; unique per user, source type and source id. Editing an activity replaces its row, and deleting it or clawing back a quest claim removes the row; `totalXp` is then re-summed from the ledger | `userId` |
| Workouts | `workouts` | A logged gym session: `title`, `exercises[]`, `duration`, `xpEarned`, `date` (a BSON date, returned by the API as an ISO instant), `idempotencyKey`, `idempotencyFingerprint` | `userId` |
| Runs | `runs` | A logged run: `distance`, `duration`, `pace`, `difficulty`, `xpEarned`, `date` (a BSON date, returned by the API as an ISO instant), `idempotencyKey`, `idempotencyFingerprint` | `userId` |
| Workout templates | `workout_templates` | A saved routine: `name`, `exercises[]`, `createdAt`, `idempotencyKey`, `idempotencyFingerprint` | `userId` |
| Custom exercises | `custom_exercises` | A user-defined exercise: `name` (stored in canonical title case), `targetMuscle`; unique per user, name and muscle | `userId` |
| User quests | `user_quests` | One user's instance of a quest for one period: `questTemplateId` (a quest id from `QUEST_DEFINITIONS`, such as `daily_workout_1`), `periodStart`, `periodEnd` (both `null` for an all-time quest), `progress`, `target`, `completed`, `claimed` | `userId` |
| User achievements | `user_achievements` | Which achievements a user has unlocked: `achievementId`, `unlockedDate` | `userId` |
| Notifications | `notifications` | One inbox entry for one recipient: `type` (`friend.requested`, `friend.accepted`, `friend.leveled-up`, `achievement.unlocked`), `data`, `actor` (name and avatar copied when the entry was written, or `null`), `sourceEventId` (the outbox event that produced it), `createdAt`, `readAt`; deleted by a TTL index after 90 days | `userId` |
| Outbox | `outbox` | A pending side effect: `type`, `payload`, `status` (`pending`, `done`, `dead`), `availableAt`, `attempts`, `completedListeners[]`, `lastError`, `createdAt`, `processedAt`; written in the same transaction as the change that caused it | none (system-owned) |
| Friendships | `friendships` | One document per unordered pair of users: `requesterId`, `receiverId`, `pairKey` (the two ids sorted and joined with `:`), `status` (`pending` / `accepted` / `declined`), `createdAt`, `updatedAt`. Re-requesting after a decline reopens the same document as `pending` with the new requester and receiver; the person who was declined cannot reopen it for `GAME_CONFIG.social.friendRequestCooldownDays` (7) after `updatedAt`, while the person who declined can at any time | `requesterId` / `receiverId` |

`user.timeZone` is an optional IANA zone (for example `Asia/Manila`) declared as a Better Auth `additionalFields` entry and validated by `timeZoneSchema`; a missing value reads as `UTC`. `player_profiles.lastActivityDay` holds the user's *local* calendar day as a `YYYY-MM-DD` string. Quest `periodStart` and `periodEnd` are local-day strings in the same zone, or `null` for an all-time quest.

Quest and achievement definitions are typed constants in code (`QUEST_DEFINITIONS` in `src/server/quests`, `ACHIEVEMENT_DEFINITIONS` in `src/shared/achievement-definitions.ts`), reviewed in git with stable string ids, not rows in a collection. The `quest_templates` and `achievements` collections are no longer read or written; they stay in the database until the step 5.1 cleanup.

Better Auth also manages its own `session`, `account` and `verification` collections through its MongoDB adapter. Never write to them directly.

Enumerations in `src/lib/types.ts` (`TargetMuscle` is defined in `src/shared/contracts/exercise.ts` and re-exported): `TargetMuscle` (Chest, Back, Legs, Arms, Core, Cardio, Full Body), `QuestCategory` (daily, weekly, special), `QuestMetric` (workout_count, run_count, run_distance), run `difficulty` (easy, moderate, hard, intense), achievement `rarity` (common, rare, epic, legendary).

## 3. Indexes

Declared in `SCHEMA` in `schema.ts` and created idempotently by `applySchema()`. `applySchema` also applies a `$jsonSchema` validator (`validationAction: error`, `validationLevel: moderate`) to `workouts`, `runs`, `custom_exercises`, `workout_templates`, `user_quests`, `user_achievements`, `friendships` and `outbox`: a new write must match, and an existing document that does not match can still be updated. The validators describe what the code writes today, so `workout_templates.createdAt` and `user_achievements.unlockedDate` are strings.

| Collection | Index | Purpose |
|---|---|---|
| workouts | `{ userId, date: -1 }` | History and date-range queries |
| workouts | `{ userId, idempotencyKey }` unique, partial | Duplicate-submit protection |
| runs | `{ userId, date: -1 }` | History and date-range queries |
| runs | `{ userId, distance: -1 }` | Longest run and the 5K and 10K record windows |
| runs | `{ userId, idempotencyKey }` unique, partial | Duplicate-submit protection |
| user_quests | `{ userId, questTemplateId, periodStart, periodEnd }` unique | One row per user, quest and period; exact-match sync lookup |
| user_quests | `{ userId }` | Listing a user's quests |
| user_achievements | `{ userId, achievementId }` unique | Listing unlocked achievements (the `userId` prefix); an achievement unlocks once per user |
| custom_exercises | `{ userId, name, targetMuscle }` unique | Listing a user's exercises (the `userId` prefix); duplicate protection |
| friendships | `{ pairKey }` unique; receiver + status; requester + status; status | One document per pair; friend lists and pending requests |
| workout_templates | `{ userId }`; `{ userId, idempotencyKey }` unique, partial | Listing, duplicate-submit protection |
| notifications | `{ userId, sourceEventId }` unique | One entry per recipient and event, so a redelivered event writes once |
| notifications | `{ userId, createdAt: -1 }` | The poll: entries since a time, newest first |
| notifications | `{ userId }` partial on `readAt: null` | The unread count, without scanning read entries |
| notifications | `{ createdAt }` TTL 90 days | Old entries expire |
| outbox | `{ availableAt }` partial on `pending`; `{ processedAt }` TTL 7 days, partial on `done` | Claiming the next due row; `done` rows expire, `dead` rows stay as the record of what failed |

## 4. API routes

Every route is declared with `defineRoute` from `@/server/runtime`, which owns auth, the rate limit, input parsing and error mapping; route files contain no `try/catch`. `Auth` is the route's `auth` setting: `user` reads the session cookie (`401` if missing), `cron` compares the bearer token with `CRON_SECRET` in constant time (`401` otherwise), `public` checks nothing. Every user mutation names a `throttle` tier from `RATE_LIMIT_TIERS` (`src/server/platform/config.ts`): `standard` allows 30 requests per minute and `expensive` allows 10 per hour, and only `POST /api/friends/request` is `expensive`. Each tier is its own Upstash sliding-window limiter (`createRateLimiter`), keyed by route name and user, so a burst on one route never blocks another. A refused request gets `429 { "error": "Too many requests" }` with a `Retry-After` header in whole seconds, taken from the end of the current window, so it is a lower bound for the `expensive` tier. When Upstash errors or times out, the request is allowed and an `[Rate limiter unavailable]` line is logged. GET, cron and public routes are not throttled. Errors are shaped by `toErrorResponse` in `src/server/platform/http`: `AppError` subclasses keep their status (`ForbiddenError` is `403`), a `DomainError` from a domain rule becomes `400` (`invalid`) or `409` (`conflict`), `ZodError` becomes `400` with the first issue's message, a malformed JSON body is `400`, a `BSONError` is `404`, and anything else is a logged `500`. A malformed id in a path is `404`. A route declared with `idempotency: "required"` (the three create routes) reads a UUID `Idempotency-Key` header before it reads the body (`400 { "error": "Missing or invalid Idempotency-Key header" }` otherwise) and hands the handler `{ key, fingerprint }`; the handler goes through `createOnce` (`src/server/platform/http/idempotency.ts`), which returns `{ value, replayed }`. A new create is `201`; a retry with the same key and an equal fingerprint is `201` with `Idempotent-Replayed: true` and runs no side effect again; the same key with any other fingerprint, including a document that stores none, is `422`. Two racing requests with the same key resolve to one document and one replay. `exercises.create` and `friends.request` dedupe on their own natural keys and answer a retry with `409` (see [[Known Issues]]). `src/app/api/__tests__/route-table.test.ts` fails when a route is not built with `defineRoute`, when a user mutation does not state its `body` or name a real `throttle` tier, when a cron or public route is throttled, when two routes share a name, or when `idempotency` is set on anything but a user `POST`. List routes read `limit` and `page` through `paginationQuery`: an invalid `limit` becomes `5`, a `limit` above `50` becomes `50`, and an invalid `page` becomes `1`.

| Route | Methods | Auth | Throttle tier | Purpose |
|---|---|---|---|---|
| `/api/auth/[...all]` | all | Better Auth | — | Sign-up, sign-in, sign-out, session; sign-up and `update-user` accept an optional `timeZone` |
| `/api/health` | GET | none | — | Liveness check |
| `/api/cron/outbox-sweep` | GET | `CRON_SECRET` bearer token (always required; `401` otherwise) | — | Daily delivery of outbox rows still pending; returns `{ delivered, failed, dead }`; scheduled in `vercel.json` |
| `/api/user` | GET | yes | — | The signed-in user's profile and game state |
| `/api/workouts` | GET, POST | yes | POST: standard | Paginated history (`limit` ≤ 50, `page`); log a workout (needs `Idempotency-Key`) |
| `/api/workouts/[id]` | PUT, DELETE | yes | standard | Edit or delete one of your workouts. Both reverse the XP the workout earned; a delete also lowers `totalWorkouts`, recounts the affected quests (clawing back a claimed reward the remaining workouts no longer support) and the streak, and emits `activity.reverted` |
| `/api/runs` | GET, POST | yes | POST: standard | Paginated history; log a run (needs `Idempotency-Key`) |
| `/api/runs/[id]` | PUT, DELETE | yes | standard | Edit or delete one of your runs. Both reverse the XP and change `totalDistance` by the exact difference and recount distance quests; a delete also recounts run quests and the streak, and emits `activity.reverted` |
| `/api/runs/stats` | GET | yes | — | Aggregate run statistics (total km, run count, average pace) computed in the database |
| `/api/workout-templates` | GET, POST | yes | POST: standard | List and create templates (create needs `Idempotency-Key`) |
| `/api/workout-templates/[id]` | DELETE | yes | standard | Delete a template |
| `/api/exercises` | GET, POST | yes | POST: standard | List the user's custom exercises (the built-in list is in `src/lib/constants/exercises.ts`); create a custom one |
| `/api/quests` | GET | yes | — | The user's quests for the current periods |
| `/api/quests/[id]/claim` | POST | yes | standard | Claim a completed quest's XP reward |
| `/api/achievements` | GET | yes | — | Achievements with the user's unlock state |
| `/api/stats/dashboard` | GET | yes | — | Weekly counts, distance, lifetime XP |
| `/api/profile/records` | GET | yes | — | Personal records |
| `/api/notifications` | GET | yes | — | The inbox: `?since=<ISO>` returns entries from that time (at most 50), without it the latest 20, plus the unread count |
| `/api/notifications/read` | PATCH | yes | standard | Mark entries read by `ids` (1–50) or `{ all: true }` |
| `/api/friends` | GET | yes | — | Accepted friends, highest level first, without personal records |
| `/api/friends/[id]/records` | GET | yes | — | One friend's personal records; 404 unless the pair is accepted |
| `/api/friends/request` | POST | yes | expensive | Send a friend request |
| `/api/friends/requests` | GET | yes | — | Pending incoming requests |
| `/api/friends/[id]/accept` | POST | yes | standard | Accept a request |
| `/api/friends/[id]/decline` | POST | yes | standard | Decline a request |
| `/api/friends/[id]` | DELETE | yes | standard | Remove a friend |

## 5. Pages

Route groups: `(landing)` public marketing page, `(auth)` public `/login` and `/signup`, `(app)` signed-in pages. `src/proxy.ts` redirects signed-out visitors away from protected prefixes and signed-in visitors away from the auth pages.

| Page | Protected | Shows |
|---|---|---|
| `/` | no | Landing page |
| `/login`, `/signup` | no (redirects away when signed in) | Email and password authentication |
| `/dashboard` | yes | XP card, activity tracker, daily quests, recent activity, muscle heatmap |
| `/workouts` | yes | Workout log form, history, template picker |
| `/templates/new` | yes | Template builder |
| `/runs` | yes | Run log form and history |
| `/quests` | yes | Daily, weekly and special quests with claim buttons |
| `/friends` | yes | Friends, pending requests, add-friend form |
| `/profile` | yes | Profile header, achievements grid, personal records |

Navigation links live in `src/lib/constants/navigation.ts`.

## 6. Background and real-time pieces

- **Outbox:** a service calls `emit(type, payload, { session })` from `src/server/platform/events` inside its transaction, which inserts one `outbox` row (`activity.logged` after a workout or run, `progression.leveled-up` after a level-up). `defineRoute` collects the ids a request emitted and, after a response below 400, runs `after(() => dispatchEvents(ids))`, which delivers those rows plus at most three overdue ones; a request that emitted nothing makes no outbox query. The listener table lives in `src/server/runtime.ts`: `achievements.evaluate` (on `activity.logged` and `progression.leveled-up`, emitting `achievement.unlocked`) and the four `notification.*` listeners that write the inbox (`friendship.requested`, `friendship.accepted`, `progression.leveled-up`, `achievement.unlocked`). `social` emits the two friendship events in the same transaction as the write. A listener must be idempotent, because a row can be delivered more than once (an unlock is an upsert, and a notification is an upsert on `(userId, sourceEventId)`); the row records which listeners already succeeded, so a retry runs only the rest. A claim holds a row for two minutes; a failed attempt waits one minute doubled per attempt (capped at six hours), and the eighth failure marks the row `dead`.
- **Cron:** `/api/cron/outbox-sweep` drains every due row until none is left or 240 seconds pass, daily at 03:00 UTC (`vercel.json`); Vercel sends the `CRON_SECRET` bearer token. `npm run outbox -- --dead` lists dead rows with their `lastError`, and `npm run outbox -- --requeue <id>` resets one to `pending`.
- **Notifications inbox:** the `notification` listeners write one `notifications` row per recipient. The browser reads them with `useNotifications` (`src/lib/notifications/`), which polls `GET /api/notifications?since=` every 30 seconds while the tab is visible, on window focus, and every 2 seconds for 10 seconds after the user's own successful mutation (listeners run in `after()`, so one immediate refetch can miss the entry; the window is a known compromise, see [[Known Issues]]). `NotificationCenter` in the app layout shows one toast for entries that arrive while the user is looking (several collapse into one), the bell shows the unread count and the tab title carries it. Redis is used only for rate limiting.
- **Scripts:** `src/scripts/migrate-db.ts` runs before every build, but only when `VERCEL_ENV` is `production` or unset: preview deployments share the production database, so they skip it. It runs the pending numbered migrations in `src/scripts/migrations/` (recorded in the `schema_migrations` collection), then `applySchema()`. Migration `001` renames a legacy `customExercises` collection to `custom_exercises`; `002` removes duplicate rows and backfills `friendships.pairKey` before the unique indexes build; `003` copies game state from `user` documents into `player_profiles` with `$setOnInsert` upserts and never writes to `user`; `004` rewrites `user_quests.questTemplateId` from the old template ObjectId to the quest id in `QUEST_DEFINITIONS` (matched by the seeded title) and turns the `"all-time"` periods into `null`, and it stops the build rather than delete rows when no template can be mapped; `005` writes an `xp_ledger` row for every workout, run and claimed quest that lacks one, then resets each profile's `totalXp`, `totalWorkouts` and `totalDistance` from the source data and raises `highestLevel` to the highest level that profile has held. `outbox.ts` is the operator tool above.

[[Guides Index]]
