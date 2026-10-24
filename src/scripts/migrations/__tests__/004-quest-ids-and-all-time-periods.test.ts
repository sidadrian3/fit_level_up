import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ObjectId } from "mongodb";
import { questIdsAndAllTimePeriodsMigration } from "../004-quest-ids-and-all-time-periods";
import { applySchema, COLLECTIONS, getDb } from "@/server/platform/database";

const userId = "quest-migration-user";
const otherUserId = "quest-migration-other-user";

const OLD_VALIDATOR = {
  $jsonSchema: {
    bsonType: "object",
    required: ["userId", "questTemplateId", "periodStart", "periodEnd"],
    properties: { periodStart: { bsonType: "string" }, periodEnd: { bsonType: "string" } },
  },
};

async function collections() {
  const db = await getDb();
  return {
    db,
    templates: db.collection(COLLECTIONS.questTemplates),
    userQuests: db.collection(COLLECTIONS.userQuests),
  };
}

async function clearAll() {
  const { templates, userQuests } = await collections();
  await templates.deleteMany({});
  await userQuests.deleteMany({});
}

async function restoreOldValidator() {
  const { db } = await collections();
  await db.command({ collMod: COLLECTIONS.userQuests, validator: OLD_VALIDATOR, validationLevel: "moderate", validationAction: "error" });
}

function row(questTemplateId: string, periodStart: string | null, periodEnd: string | null, overrides: { userId?: string } = {}) {
  return { userId, questTemplateId, progress: 0, target: 1, completed: false, claimed: false, periodStart, periodEnd, ...overrides };
}

describe("004-quest-ids-and-all-time-periods", () => {
  const dailyBurnId = new ObjectId();
  const weekendWarriorId = new ObjectId();
  const retiredId = new ObjectId();

  beforeEach(async () => {
    await clearAll();
    const { db, templates } = await collections();
    await applySchema(db);
    await templates.insertMany([
      { _id: dailyBurnId, title: "Daily Burn" },
      { _id: weekendWarriorId, title: "Weekend Warrior" },
      { _id: retiredId, title: "Retired Quest" },
    ]);
  });

  afterAll(async () => {
    await clearAll();
    await applySchema(await getDb());
  });

  it("remaps template ids, nulls all-time periods, drops unknown rows, and is a no-op the second time", async () => {
    await restoreOldValidator();
    const { db, userQuests } = await collections();
    await userQuests.insertMany([
      row(dailyBurnId.toString(), "2026-10-20", "2026-10-20"),
      row(weekendWarriorId.toString(), "all-time", "all-time"),
      row(retiredId.toString(), "2026-10-20", "2026-10-20"),
      row(new ObjectId().toString(), "2026-10-20", "2026-10-20"),
      row(weekendWarriorId.toString(), "all-time", "all-time", { userId: otherUserId }),
    ]);

    await questIdsAndAllTimePeriodsMigration.up(db);

    const rowsAfterFirstRun = await userQuests.find({}, { projection: { _id: 0 } }).sort({ userId: 1, questTemplateId: 1 }).toArray();
    expect(rowsAfterFirstRun.map(({ userId: owner, questTemplateId, periodStart, periodEnd }) => ({ owner, questTemplateId, periodStart, periodEnd }))).toEqual([
      { owner: otherUserId, questTemplateId: "weekend_run_1", periodStart: null, periodEnd: null },
      { owner: userId, questTemplateId: "daily_workout_1", periodStart: "2026-10-20", periodEnd: "2026-10-20" },
      { owner: userId, questTemplateId: "weekend_run_1", periodStart: null, periodEnd: null },
    ]);

    await questIdsAndAllTimePeriodsMigration.up(db);

    const rowsAfterSecondRun = await userQuests.find({}, { projection: { _id: 0 } }).sort({ userId: 1, questTemplateId: 1 }).toArray();
    expect(rowsAfterSecondRun).toEqual(rowsAfterFirstRun);
  });

  it("refuses to run, leaving the rows intact, when no template maps to a quest definition", async () => {
    const { db, templates, userQuests } = await collections();
    await templates.deleteMany({});
    await userQuests.insertOne(row(dailyBurnId.toString(), "2026-10-20", "2026-10-20"));

    await expect(questIdsAndAllTimePeriodsMigration.up(db)).rejects.toThrow(/legacy quest template ids/);

    expect(await userQuests.countDocuments({})).toBe(1);
  });

  it("drops the old row when the new-style row for the same period already exists", async () => {
    const { db, userQuests } = await collections();
    await userQuests.createIndex(
      { userId: 1, questTemplateId: 1, periodStart: 1, periodEnd: 1 },
      { unique: true, name: "idx_userQuests_sync_lookup" }
    );
    try {
      await userQuests.insertMany([
        row("daily_workout_1", "2026-10-20", "2026-10-20"),
        row(dailyBurnId.toString(), "2026-10-20", "2026-10-20"),
        row("weekend_run_1", null, null),
        row(weekendWarriorId.toString(), "all-time", "all-time"),
      ]);

      await questIdsAndAllTimePeriodsMigration.up(db);

      expect(await userQuests.countDocuments({ questTemplateId: "daily_workout_1" })).toBe(1);
      expect(await userQuests.countDocuments({ questTemplateId: "weekend_run_1", periodStart: null, periodEnd: null })).toBe(1);
      expect(await userQuests.countDocuments({})).toBe(2);
    } finally {
      await userQuests.dropIndex("idx_userQuests_sync_lookup");
    }
  });

  it("nulls the all-time periods of a row the new code already wrote with a string id", async () => {
    await restoreOldValidator();
    const { db, userQuests } = await collections();
    await userQuests.insertOne(row("weekend_run_1", "all-time", "all-time"));

    await questIdsAndAllTimePeriodsMigration.up(db);

    expect(await userQuests.findOne({ userId })).toMatchObject({ questTemplateId: "weekend_run_1", periodStart: null, periodEnd: null });
  });
});
