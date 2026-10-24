import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ObjectId } from "mongodb";
import { backfillXpLedgerMigration } from "../005-backfill-xp-ledger";
import { COLLECTIONS, getDb } from "@/server/platform/database";
import { levelFromTotalXp } from "@/server/progression";

const userId = "ledger-migration-user";
const occurredAt = new Date("2026-03-09T20:00:00Z");
const createdAt = new Date("2026-01-01T08:00:00Z");

async function collections() {
  const db = await getDb();
  return {
    db,
    workouts: db.collection(COLLECTIONS.workouts),
    runs: db.collection(COLLECTIONS.runs),
    userQuests: db.collection(COLLECTIONS.userQuests),
    ledger: db.collection(COLLECTIONS.xpLedger),
    profiles: db.collection<{ _id: string }>(COLLECTIONS.playerProfiles),
  };
}

async function clearAll() {
  const { workouts, runs, userQuests, ledger, profiles } = await collections();
  await Promise.all([workouts, runs, userQuests, ledger].map((collection) => collection.deleteMany({})).concat(profiles.deleteMany({})));
}

function workout(xpEarned: number) {
  return { _id: new ObjectId(), userId, title: "Push day", exercises: [], duration: 30, xpEarned, date: occurredAt };
}

function run(xpEarned: number, distance: number) {
  return { _id: new ObjectId(), userId, distance, duration: 20, pace: 5, difficulty: "easy", xpEarned, date: occurredAt };
}

function questRow(questTemplateId: string, claimed: boolean) {
  return {
    _id: new ObjectId(),
    userId,
    questTemplateId,
    progress: 1,
    target: 1,
    completed: claimed,
    claimed,
    periodStart: "2026-03-09",
    periodEnd: "2026-03-09",
  };
}

function profile(overrides: { totalXp: number; totalWorkouts: number; totalDistance: number }) {
  return {
    _id: userId,
    highestLevel: 1,
    streak: 2,
    stamina: 40,
    lastActivityDay: "2026-03-09",
    lastStaminaUpdate: createdAt,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe("005-backfill-xp-ledger", () => {
  beforeEach(clearAll);
  afterAll(clearAll);

  it("creates ledger rows for workouts, runs and claimed quests", async () => {
    const { db, workouts, runs, userQuests, ledger } = await collections();
    const claimed = questRow("daily_workout_1", true);
    const savedWorkout = workout(120);
    const savedRun = run(80, 3.5);
    await workouts.insertOne(savedWorkout);
    await runs.insertOne(savedRun);
    await userQuests.insertMany([claimed, questRow("daily_run_2km", false), questRow("retired_quest", true)]);

    await backfillXpLedgerMigration.up(db);

    const rows = await ledger.find({}, { projection: { _id: 0, userId: 1, sourceType: 1, sourceId: 1, amount: 1, occurredAt: 1 } }).sort({ sourceType: 1 }).toArray();
    expect(rows).toEqual([
      { userId, sourceType: "quest_claim", sourceId: claimed._id.toString(), amount: 100, occurredAt: claimed._id.getTimestamp() },
      { userId, sourceType: "run", sourceId: savedRun._id.toString(), amount: 80, occurredAt },
      { userId, sourceType: "workout", sourceId: savedWorkout._id.toString(), amount: 120, occurredAt },
    ]);
  });

  it("keeps existing ledger rows", async () => {
    const { db, workouts, ledger } = await collections();
    const savedWorkout = workout(120);
    await workouts.insertOne(savedWorkout);
    await ledger.insertOne({ userId, sourceType: "workout", sourceId: savedWorkout._id.toString(), amount: 90, occurredAt, createdAt });

    await backfillXpLedgerMigration.up(db);

    const rows = await ledger.find({ userId }).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 90, createdAt });
  });

  it("resets XP, totals and highestLevel from the source data", async () => {
    const { db, workouts, runs, profiles } = await collections();
    await workouts.insertOne(workout(120));
    await runs.insertOne(run(80, 3.5));
    await profiles.insertOne(profile({ totalXp: 5000, totalWorkouts: 9, totalDistance: 40 }));

    await backfillXpLedgerMigration.up(db);

    expect(await profiles.findOne({ _id: userId })).toMatchObject({
      totalXp: 200,
      totalWorkouts: 1,
      totalDistance: 3.5,
      highestLevel: levelFromTotalXp(5000).level,
      streak: 2,
      stamina: 40,
    });
  });

  it("is a no-op on a second run", async () => {
    const { db, workouts, runs, userQuests, ledger, profiles } = await collections();
    await workouts.insertOne(workout(120));
    await runs.insertOne(run(80, 3.5));
    await userQuests.insertOne(questRow("daily_workout_1", true));
    await profiles.insertOne(profile({ totalXp: 5000, totalWorkouts: 9, totalDistance: 40 }));
    const snapshot = async () => ({
      ledger: await ledger.find({}).sort({ sourceType: 1 }).toArray(),
      profile: await profiles.findOne({}, { projection: { updatedAt: 0 } }),
    });

    await backfillXpLedgerMigration.up(db);
    const afterFirstRun = await snapshot();
    await backfillXpLedgerMigration.up(db);

    expect(await snapshot()).toEqual(afterFirstRun);
  });
});
