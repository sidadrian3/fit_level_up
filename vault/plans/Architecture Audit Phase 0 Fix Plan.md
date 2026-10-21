# Architecture Audit Phase 0 Fix Plan

Fixes steps 0.1–0.6 of [[Architecture Overhaul Audit]] §8 in one PR. Step 0.7 (per-user time zone, F-8) is a separate feature, and F-4 waits for the XP ledger (audit §8.1).

Every root cause below was confirmed by a throwaway repro test that drove the real code path and failed with the audit's exact symptom (11 of 11 red before the fix).

## Root causes

| Finding | Root cause | Symptom |
|---|---|---|
| F-1 | Domain rules (`quest-rules`, `friend-rules`, `workout-rules`, `run-rules`) and `getUserFromDb` throw plain `Error`; `handleApiError` maps only `AppError` and `ZodError` | Rule violations return 500 and are logged as `[Unhandled API Error]` |
| F-13 | No `ForbiddenError` exists, so the friend services throw `UnauthorizedError` | Accepting or declining someone else's request returns 401 |
| F-2 | `new ObjectId(id)` throws on malformed input in `quests-db` and `workout-templates-db`, which lack the `isValid` guard the other modules use | `POST /api/quests/abc/claim` and `DELETE /api/workout-templates/abc` return 500 |
| F-12 | `POST /api/exercises` destructures the raw body; no Zod schema and no rate limit | `{ name: 123 }` returns 500; `targetMuscle: "Banana"` is stored |
| F-14 | `/templates` is missing from `protectedRoutes`; the cron guard runs only `if (process.env.CRON_SECRET)`; there is no `vercel.json`, so the cron is never scheduled | Signed-out visitors see `/templates/new`; the sweep is open when the secret is unset |
| F-5 | Read-then-insert with no unique index on `user_achievements (userId, achievementId)` or custom exercises; template create checks then inserts | Concurrent calls create duplicate unlocks and exercises; a racing template retry gets a raw duplicate-key 500 |
| F-3 | `syncCooldowns` is created inside `getUserQuests`, so it is always empty | Every quest read runs a full `bulkWrite` |
| F-6 | `updateQuestProgress` skips `user_quests` rows that don't exist yet, and its reads ignore the transaction session | A workout logged before the quests page is opened earns no quest progress |
| F-7 | The unique index is `(requesterId, receiverId)` and a re-request inserts a new document | Re-request after decline returns 409; B→A after a declined A→B creates a second document |

## Steps

### 1. Domain and authorization errors (F-1, F-13)

- [ ] Add `DomainError` in `src/lib/domain/domain-error.ts` with a `kind` of `"invalid"` (400) or `"conflict"` (409). Domain rules throw it; the domain layer keeps importing nothing from `lib/api`.
- [ ] `handleApiError` maps `DomainError` by `kind`.
- [ ] Add `ForbiddenError` (403) to `errors.ts`; the accept, decline and remove friend services use it.
- [ ] `getUserFromDb` throws `NotFoundError`; the optimistic-lock exhaustion errors become `ConflictError`.
- [ ] Route tests: an incomplete quest claim returns 400, a self friend request returns 400, accepting another user's request returns 403, and none of them logs `[Unhandled API Error]`.

### 2. Malformed ids (F-2)

- [ ] Add `parseObjectId(id): ObjectId | null` in `src/lib/data/object-id.ts` and use it for every by-id lookup in `quests-db`, `workout-templates-db`, `workout-db`, `runs-db` and `friendships-db`.
- [ ] Route tests: claim and template delete with id `abc` return 404.

### 3. Security quick fixes (F-12, F-14)

- [ ] `CreateCustomExerciseSchema` in `schemas.ts` (name trimmed, 1–100 characters; `targetMuscle` as `z.enum(TargetMuscle)`); the exercises route parses it and applies `RateLimit`.
- [ ] Add `/templates` to `protectedRoutes`.
- [ ] `CRON_SECRET` is required in `env.ts`; the cron route rejects every request without the matching bearer token through `handleApiError`. Add `vercel.json` with a daily schedule for the sweep.
- [ ] Route tests: an invalid exercise body returns 400, and the cron route without a token returns 401. Remove both sections from [[Known Issues]].

### 4. Unique keys (F-5)

- [ ] Unique indexes: `user_achievements (userId, achievementId)`, custom exercises `(userId, name, targetMuscle)` (the stored name is already canonical through `formatExerciseName`, which now also collapses repeated whitespace), and `friendships (pairKey)` for step 6.
- [ ] `insertUserAchievements` upserts with `$setOnInsert` and returns the ids it actually inserted, so `evaluateAchievements` reports only real unlocks.
- [ ] `createCustomExercise` inserts and maps duplicate key to `ConflictError`, with no pre-read.
- [ ] Template creation inserts first and, on a duplicate `idempotencyKey`, returns the existing template from the service, like `logWorkout`.
- [ ] Add a shared `isDuplicateKeyError(err, field)` helper for every duplicate-key catch.
- [ ] Add an idempotent `src/scripts/prepare-unique-indexes.ts` that runs before `ensureIndexes` in `migrate-db.ts`: it removes duplicate unlocks (keeping the earliest) and duplicate custom exercises (keeping the oldest), backfills `pairKey` and merges duplicate friendships (keeping the accepted one, otherwise the newest).
- [ ] Integration tests: concurrent evaluations give one unlock; concurrent identical creates give one row and no 500; the script dedupes seeded duplicates and is safe to run twice.

### 5. Quest sync (F-3, F-6)

- [ ] Remove the broken cooldown; `getUserQuests` always syncs, since the sync is an idempotent upsert.
- [ ] Extract the row upsert from `syncUserQuests` so `updateQuestProgress` can upsert the current period's rows for the affected metrics before applying progress.
- [ ] `updateQuestProgress` takes a required `session` and passes it to every read and write.
- [ ] Integration test: a user with no `user_quests` rows logs a workout and gets daily and weekly `workout_count` progress of 1.

### 6. Friend re-request (F-7)

- [ ] `friendships.pairKey` holds the two ids sorted and joined. `getFriendshipBetweenFromDb` looks up by `pairKey`.
- [ ] `sendFriendRequest` uses one atomic `findOneAndUpdate` with `upsert`, matching `{ pairKey, status: "declined" }`: a declined pair resets to pending with the new direction; a missing pair is inserted; a pending or accepted pair hits the unique index and becomes `ConflictError`.
- [ ] Integration tests: decline then re-request gives pending; B→A after a declined A→B reuses the same document; concurrent A→B and B→A give one document.

[[Plans Index]]
