import type { AnyBulkWriteOperation, Db, ObjectId } from "mongodb";
import { COLLECTIONS } from "@/server/platform/database";
import { calcLifetimeXp, levelFromTotalXp } from "@/server/progression";
import type { Migration } from "./run-migrations";

const BATCH_SIZE = 500;

type LegacyGameUser = {
  _id: ObjectId;
  level: number;
  xp?: number;
  streak?: number;
  lastActivityDate?: Date;
  stamina?: number;
  lastStaminaUpdate?: Date;
  totalWorkouts?: number;
  totalDistance?: number;
  createdAt?: Date;
};

type ProfileUpsert = AnyBulkWriteOperation<{ _id: string }>;

const LEGACY_GAME_PROJECTION = {
  level: 1,
  xp: 1,
  streak: 1,
  lastActivityDate: 1,
  stamina: 1,
  lastStaminaUpdate: 1,
  totalWorkouts: 1,
  totalDistance: 1,
  createdAt: 1,
} as const;

function toProfileUpsert(user: LegacyGameUser, now: Date): ProfileUpsert {
  const totalXp = calcLifetimeXp(user.level, user.xp ?? 0);
  return {
    updateOne: {
      filter: { _id: user._id.toString() },
      update: {
        $setOnInsert: {
          totalXp,
          highestLevel: levelFromTotalXp(totalXp).level,
          streak: user.streak ?? 0,
          lastActivityDay: user.lastActivityDate?.toISOString().slice(0, 10) ?? null,
          stamina: user.stamina ?? 100,
          lastStaminaUpdate: user.lastStaminaUpdate ?? user.createdAt ?? now,
          totalWorkouts: user.totalWorkouts ?? 0,
          totalDistance: user.totalDistance ?? 0,
          createdAt: now,
          updatedAt: now,
        },
      },
      upsert: true,
    },
  };
}

// Expand-only: the user documents keep their game fields until a later contract step
async function backfillPlayerProfiles(db: Db): Promise<void> {
  const profiles = db.collection<{ _id: string }>(COLLECTIONS.playerProfiles);
  const cursor = db
    .collection<LegacyGameUser>(COLLECTIONS.user)
    .find({ level: { $exists: true } }, { projection: LEGACY_GAME_PROJECTION });
  const now = new Date();

  let batch: ProfileUpsert[] = [];
  let seen = 0;
  for await (const user of cursor) {
    batch.push(toProfileUpsert(user, now));
    seen += 1;
    if (batch.length === BATCH_SIZE) {
      await profiles.bulkWrite(batch, { ordered: false });
      batch = [];
    }
  }
  if (batch.length > 0) await profiles.bulkWrite(batch, { ordered: false });

  console.log(`Backfilled player profiles for ${seen} users.`);
}

export const backfillPlayerProfilesMigration: Migration = {
  name: "003-backfill-player-profiles",
  up: backfillPlayerProfiles,
};
