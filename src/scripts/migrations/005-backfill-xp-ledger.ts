import type { AnyBulkWriteOperation, Collection, Db, Document, ObjectId } from "mongodb";
import { COLLECTIONS } from "@/server/platform/database";
import { levelFromTotalXp } from "@/server/progression";
import { QUEST_DEFINITIONS } from "@/server/quests";
import type { Migration } from "./run-migrations";

const BATCH_SIZE = 500;

type LedgerSourceType = "workout" | "run" | "quest_claim";

type ActivityRow = { _id: ObjectId; userId: string; xpEarned: number; date: Date };

type ClaimedQuestRow = { _id: ObjectId; userId: string; questTemplateId: string };

type ProfileRow = { _id: string; totalXp: number; highestLevel?: number };

type UserTotal = { _id: string; total: number };

type BulkOperation<TDocument extends Document = Document> = AnyBulkWriteOperation<TDocument>;

type ProfileReset = BulkOperation<ProfileRow>;

function ledgerUpsert(
  userId: string,
  sourceType: LedgerSourceType,
  sourceId: string,
  amount: number,
  occurredAt: Date,
  now: Date
): BulkOperation {
  return {
    updateOne: {
      filter: { userId, sourceType, sourceId },
      update: { $setOnInsert: { userId, sourceType, sourceId, amount, occurredAt, createdAt: now } },
      upsert: true,
    },
  };
}

async function writeInBatches<TDocument extends Document>(
  collection: Collection<TDocument>,
  operations: AsyncIterable<BulkOperation<TDocument>>
): Promise<number> {
  let batch: BulkOperation<TDocument>[] = [];
  let written = 0;
  for await (const operation of operations) {
    batch.push(operation);
    written += 1;
    if (batch.length === BATCH_SIZE) {
      await collection.bulkWrite(batch, { ordered: false });
      batch = [];
    }
  }
  if (batch.length > 0) await collection.bulkWrite(batch, { ordered: false });
  return written;
}

async function* activityUpserts(db: Db, collection: string, sourceType: "workout" | "run", now: Date): AsyncGenerator<BulkOperation> {
  const rows = db.collection<ActivityRow>(collection).find({}, { projection: { userId: 1, xpEarned: 1, date: 1 } });
  for await (const row of rows) {
    yield ledgerUpsert(row.userId, sourceType, row._id.toString(), row.xpEarned, row.date, now);
  }
}

// Claim time is not stored, so the row's creation time stands in for it
async function* claimUpserts(db: Db, now: Date): AsyncGenerator<BulkOperation> {
  const rows = db
    .collection<ClaimedQuestRow>(COLLECTIONS.userQuests)
    .find({ claimed: true, questTemplateId: { $in: Object.keys(QUEST_DEFINITIONS) } }, { projection: { userId: 1, questTemplateId: 1 } });
  for await (const row of rows) {
    const definition = QUEST_DEFINITIONS[row.questTemplateId as keyof typeof QUEST_DEFINITIONS];
    yield ledgerUpsert(row.userId, "quest_claim", row._id.toString(), definition.xpReward, row._id.getTimestamp(), now);
  }
}

async function totalsByUser(db: Db, collection: string, sumField: "amount" | "distance" | null): Promise<Map<string, number>> {
  const accumulator = sumField ? { $sum: `$${sumField}` } : { $sum: 1 };
  const totals = await db
    .collection(collection)
    .aggregate<UserTotal>([{ $group: { _id: "$userId", total: accumulator } }])
    .toArray();
  return new Map(totals.map(({ _id, total }) => [_id, total]));
}

// Profiles are only reset, never created: a user with activities but no profile gets one from the next write
async function* profileResets(db: Db, now: Date): AsyncGenerator<ProfileReset> {
  const [ledgerXp, workoutCounts, runDistances] = await Promise.all([
    totalsByUser(db, COLLECTIONS.xpLedger, "amount"),
    totalsByUser(db, COLLECTIONS.workouts, null),
    totalsByUser(db, COLLECTIONS.runs, "distance"),
  ]);
  const profiles = db.collection<ProfileRow>(COLLECTIONS.playerProfiles).find({}, { projection: { totalXp: 1, highestLevel: 1 } });
  for await (const profile of profiles) {
    const totalXp = ledgerXp.get(profile._id) ?? 0;
    // The stored mark joins the max so a second run cannot lower it
    const highestLevel = Math.max(profile.highestLevel ?? 1, levelFromTotalXp(profile.totalXp).level, levelFromTotalXp(totalXp).level);
    yield {
      updateOne: {
        filter: { _id: profile._id },
        update: {
          $set: {
            totalXp,
            totalWorkouts: workoutCounts.get(profile._id) ?? 0,
            totalDistance: runDistances.get(profile._id) ?? 0,
            highestLevel,
            updatedAt: now,
          },
        },
      },
    };
  }
}

async function backfillXpLedger(db: Db): Promise<void> {
  const now = new Date();
  const ledger = db.collection(COLLECTIONS.xpLedger);

  const workouts = await writeInBatches(ledger, activityUpserts(db, COLLECTIONS.workouts, "workout", now));
  const runs = await writeInBatches(ledger, activityUpserts(db, COLLECTIONS.runs, "run", now));
  const claims = await writeInBatches(ledger, claimUpserts(db, now));
  const profiles = await writeInBatches(db.collection<ProfileRow>(COLLECTIONS.playerProfiles), profileResets(db, now));

  console.log(`Backfilled XP ledger from ${workouts} workouts, ${runs} runs and ${claims} claimed quests; reset ${profiles} profiles.`);
}

export const backfillXpLedgerMigration: Migration = {
  name: "005-backfill-xp-ledger",
  up: backfillXpLedger,
};
