# Data Model And API Reference

Every MongoDB collection, every API route and every page in FitLevelUp. The code is the source of truth: collection names, document types, indexes and validators come from `src/server/platform/database/schema.ts`, and shared types from `src/lib/types.ts` and `src/shared/contracts/`. This note is kept in step with them by the Handbook Sync step ([[Developer Handbook]] §7).

---

## 1. Conventions

- Every document that belongs to a person carries a `userId`, and every query filters on it. The `userId` comes from the session (`defineRoute({ auth: "user" })` hands it to the handler), never from the request.
- Dates are stored as BSON `Date` and returned to the browser as ISO strings (`DateString`).
- Creates that a retry could repeat carry a client-generated `idempotencyKey`, backed by a unique partial index.
- Collection names are fixed in `COLLECTIONS` in `schema.ts`; no environment variable overrides them.

## 2. Collections

| Collection | Default name | Holds | Owner field |
|---|---|---|---|
| Users | `user` | The Better Auth user plus game state: `level`, `xp`, `xpToNextLevel`, `streak`, `lastActivityDate`, `totalWorkouts`, `totalDistance`, `stamina`, `lastStaminaUpdate`, `avatar`, `timeZone` | `_id` |
| Workouts | `workouts` | A logged gym session: `title`, `exercises[]`, `duration`, `xpEarned`, `date`, `idempotencyKey` | `userId` |
| Runs | `runs` | A logged run: `distance`, `duration`, `pace`, `difficulty`, `xpEarned`, `date`, `idempotencyKey` | `userId` |
| Workout templates | `workout_templates` | A saved routine: `name`, `exercises[]`, `createdAt`, `idempotencyKey` | `userId` |
| Custom exercises | `custom_exercises` | A user-defined exercise: `name` (stored in canonical title case), `targetMuscle`; unique per user, name and muscle | `userId` |
| Quest templates | `quest_templates` | The catalogue of quests (`title`, `category`, `metric`, `target`, `xpReward`, `icon`, `isActive`); seeded by `npm run seed` | none (global) |
| User quests | `user_quests` | One user's instance of a quest for one period: `questTemplateId`, `periodStart`, `periodEnd`, `progress`, `target`, `completed`, `claimed` | `userId` |
| Achievements | `achievements` | The catalogue of achievements (`id`, `title`, `rarity`, `condition`); seeded by `npm run seed` | none (global) |
| User achievements | `user_achievements` | Which achievements a user has unlocked: `achievementId`, `unlockedDate` | `userId` |
| Friendships | `friendships` | One document per unordered pair of users: `requesterId`, `receiverId`, `pairKey` (the two ids sorted and joined with `:`), `status` (`pending` / `accepted` / `declined`), `createdAt`, `updatedAt`. Re-requesting after a decline reopens the same document as `pending` with the new requester and receiver | `requesterId` / `receiverId` |

`user.timeZone` is an optional IANA zone (for example `Asia/Manila`) declared as a Better Auth `additionalFields` entry and validated by `timeZoneSchema`; a missing value reads as `UTC`. `lastActivityDate` is a `Date` at UTC midnight that holds the user's *local* calendar day. Quest `periodStart` and `periodEnd` are local-day strings in the same zone.

Better Auth also manages its own `session`, `account` and `verification` collections through its MongoDB adapter. Never write to them directly.

Enumerations in `src/lib/types.ts` (`TargetMuscle` is defined in `src/shared/contracts/exercise.ts` and re-exported): `TargetMuscle` (Chest, Back, Legs, Arms, Core, Cardio, Full Body), `QuestCategory` (daily, weekly, special), `QuestMetric` (workout_count, run_count, run_distance), run `difficulty` (easy, moderate, hard, intense), achievement `rarity` (common, rare, epic, legendary).

## 3. Indexes

Declared in `SCHEMA` in `schema.ts` and created idempotently by `applySchema()`. `applySchema` also applies a `$jsonSchema` validator (`validationAction: error`, `validationLevel: moderate`) to `workouts`, `runs`, `custom_exercises`, `workout_templates`, `user_quests`, `user_achievements` and `friendships`: a new write must match, and an existing document that does not match can still be updated. The validators describe what the code writes today, so `workout_templates.createdAt` and `user_achievements.unlockedDate` are strings.

| Collection | Index | Purpose |
|---|---|---|
| workouts | `{ userId, date: -1 }` | History and date-range queries |
| workouts | `{ userId, idempotencyKey }` unique, partial | Duplicate-submit protection |
| runs | `{ userId, date: -1 }` | History and date-range queries |
| runs | `{ userId, idempotencyKey }` unique, partial | Duplicate-submit protection |
| user_quests | `{ userId, questTemplateId, periodStart, periodEnd }` unique | One row per user, quest and period; exact-match sync lookup |
| user_quests | `{ userId }` | Listing a user's quests |
| quest_templates | `{ isActive, metric }` | Finding quests a new activity advances |
| user_achievements | `{ userId, achievementId }` unique | Listing unlocked achievements (the `userId` prefix); an achievement unlocks once per user |
| custom_exercises | `{ userId, name, targetMuscle }` unique | Listing a user's exercises (the `userId` prefix); duplicate protection |
| friendships | `{ pairKey }` unique; receiver + status; requester + status; status | One document per pair; friend lists and pending requests |
| workout_templates | `{ userId }`; `{ userId, idempotencyKey }` unique, partial | Listing, duplicate-submit protection |

## 4. API routes

Every route is declared with `defineRoute` from `@/server/runtime`, which owns auth, the rate limit, input parsing and error mapping; route files contain no `try/catch`. `Auth` is the route's `auth` setting: `user` reads the session cookie (`401` if missing), `cron` compares the bearer token with `CRON_SECRET` in constant time (`401` otherwise), `public` checks nothing. `Rate-limited` routes set `throttle: "standard"`, the shared sliding window of 20 requests per hour per user (`src/lib/auth/rate-limit.ts`); a mutation that is not limited yet sets `throttle: null` explicitly. Errors are shaped by `toErrorResponse` in `src/server/platform/http`: `AppError` subclasses keep their status (`ForbiddenError` is `403`), a `DomainError` from a domain rule becomes `400` (`invalid`) or `409` (`conflict`), `ZodError` becomes `400` with the first issue's message, a malformed JSON body is `400`, a `BSONError` is `404`, and anything else is a logged `500`. A malformed id in a path is `404`. `src/app/api/__tests__/route-table.test.ts` fails when a route is not built with `defineRoute`, when a user mutation does not state its `body` and `throttle`, when a cron or public route is throttled, or when two routes share a name. List routes read `limit` and `page` through `paginationQuery`: an invalid `limit` becomes `5`, a `limit` above `50` becomes `50`, and an invalid `page` becomes `1`.

| Route | Methods | Auth | Rate-limited | Purpose |
|---|---|---|---|---|
| `/api/auth/[...all]` | all | Better Auth | — | Sign-up, sign-in, sign-out, session; sign-up and `update-user` accept an optional `timeZone` |
| `/api/health` | GET | none | — | Liveness check |
| `/api/cron/achievements-sweep` | GET | `CRON_SECRET` bearer token (always required; `401` otherwise) | — | Daily reconciliation of locked achievements, scheduled in `vercel.json` |
| `/api/user` | GET | yes | — | The signed-in user's profile and game state |
| `/api/workouts` | GET, POST | yes | POST | Paginated history (`limit` ≤ 50, `page`); log a workout |
| `/api/workouts/[id]` | PUT, DELETE | yes | — | Edit or delete one of your workouts |
| `/api/runs` | GET, POST | yes | POST | Paginated history; log a run |
| `/api/runs/[id]` | PUT, DELETE | yes | — | Edit or delete one of your runs |
| `/api/runs/stats` | GET | yes | — | Aggregate run statistics |
| `/api/workout-templates` | GET, POST | yes | — | List and create templates |
| `/api/workout-templates/[id]` | DELETE | yes | — | Delete a template |
| `/api/exercises` | GET, POST | yes | POST | List the user's custom exercises (the built-in list is in `src/lib/constants/exercises.ts`); create a custom one |
| `/api/quests` | GET | yes | — | The user's quests for the current periods |
| `/api/quests/[id]/claim` | POST | yes | — | Claim a completed quest's XP reward |
| `/api/achievements` | GET | yes | — | Achievements with the user's unlock state |
| `/api/stats/dashboard` | GET | yes | — | Weekly counts, distance, lifetime XP |
| `/api/profile/records` | GET | yes | — | Personal records |
| `/api/friends` | GET | yes | — | Accepted friends |
| `/api/friends/request` | POST | yes | yes | Send a friend request |
| `/api/friends/requests` | GET | yes | — | Pending incoming requests |
| `/api/friends/[id]/accept` | POST | yes | yes | Accept a request |
| `/api/friends/[id]/decline` | POST | yes | yes | Decline a request |
| `/api/friends/[id]` | DELETE | yes | yes | Remove a friend |
| `/api/friends/events` | GET | yes | — | Server-Sent Events stream of friend events; the connection lasts 60 seconds and the browser reconnects |

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

- **Cron:** `/api/cron/achievements-sweep` runs `sweepLockedAchievements` for every user active in the last 72 hours (a local-day `lastActivityDate` can sit up to 36 hours before the activity), daily at 03:00 UTC (`vercel.json`); Vercel sends the `CRON_SECRET` bearer token.
- **SSE:** services publish events to a per-user Redis list (`sse:{userId}`, 60-second TTL) through `src/lib/sse/sse-publisher.ts`; `/api/friends/events` drains it into the browser, where `FriendEventManager` and the level-up and achievement managers show toasts.
- **Scripts:** `src/scripts/migrate-db.ts` runs before every build, but only when `VERCEL_ENV` is `production` or unset: preview deployments share the production database, so they skip it. It runs the pending numbered migrations in `src/scripts/migrations/` (recorded in the `schema_migrations` collection), then `applySchema()`. Migration `001` renames a legacy `customExercises` collection to `custom_exercises`; `002` removes duplicate rows and backfills `friendships.pairKey` before the unique indexes build. `seed-quests.ts` and `seed-achievements.ts` fill the catalogues.

[[Guides Index]]
