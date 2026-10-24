import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ObjectId } from "mongodb";
import { backfillPlayerProfilesMigration } from "../003-backfill-player-profiles";
import { COLLECTIONS, getDb } from "@/server/platform/database";
import { levelFromTotalXp } from "@/server/progression";

const createdAt = new Date("2026-01-01T08:00:00Z");

async function collections() {
  const db = await getDb();
  return { db, users: db.collection(COLLECTIONS.user), profiles: db.collection(COLLECTIONS.playerProfiles) };
}

async function clearAll() {
  const { users, profiles } = await collections();
  await users.deleteMany({});
  await profiles.deleteMany({});
}

describe("003-backfill-player-profiles", () => {
  beforeEach(clearAll);
  afterAll(clearAll);

  it("creates a profile from a user's game fields", async () => {
    const { db, users, profiles } = await collections();
    const _id = new ObjectId();
    const lastStaminaUpdate = new Date("2026-02-01T10:00:00Z");
    await users.insertOne({
      _id,
      level: 3,
      xp: 200,
      streak: 4,
      lastActivityDate: new Date("2026-03-05T00:00:00Z"),
      stamina: 60,
      lastStaminaUpdate,
      totalWorkouts: 7,
      totalDistance: 12.5,
      createdAt,
    });

    await backfillPlayerProfilesMigration.up(db);

    const profile = await profiles.findOne({ _id: _id.toString() as never });
    expect(profile).toMatchObject({
      totalXp: 1700,
      streak: 4,
      lastActivityDay: "2026-03-05",
      stamina: 60,
      lastStaminaUpdate,
      totalWorkouts: 7,
      totalDistance: 12.5,
    });
    expect(profile?.createdAt).toBeInstanceOf(Date);
    expect(profile?.updatedAt).toBeInstanceOf(Date);
    expect(levelFromTotalXp(profile?.totalXp)).toMatchObject({ level: 3, xp: 200 });
  });

  it("defaults the missing game fields", async () => {
    const { db, users, profiles } = await collections();
    const _id = new ObjectId();
    await users.insertOne({ _id, level: 1, createdAt });

    await backfillPlayerProfilesMigration.up(db);

    expect(await profiles.findOne({ _id: _id.toString() as never })).toMatchObject({
      totalXp: 0,
      streak: 0,
      lastActivityDay: null,
      stamina: 100,
      lastStaminaUpdate: createdAt,
      totalWorkouts: 0,
      totalDistance: 0,
    });
  });

  it("skips users without game fields", async () => {
    const { db, users, profiles } = await collections();
    await users.insertOne({ _id: new ObjectId(), name: "No Game", createdAt });

    await backfillPlayerProfilesMigration.up(db);

    expect(await profiles.countDocuments({})).toBe(0);
  });

  it("does not overwrite an existing profile", async () => {
    const { db, users, profiles } = await collections();
    const _id = new ObjectId();
    await users.insertOne({ _id, level: 5, xp: 10, streak: 1, createdAt });
    await backfillPlayerProfilesMigration.up(db);
    await profiles.updateOne({ _id: _id.toString() as never }, { $set: { totalXp: 99999 } });

    await backfillPlayerProfilesMigration.up(db);

    expect(await profiles.findOne({ _id: _id.toString() as never })).toMatchObject({ totalXp: 99999 });
  });

  it("is a no-op on rerun", async () => {
    const { db, users, profiles } = await collections();
    await users.insertOne({ _id: new ObjectId(), level: 2, xp: 5, streak: 1, createdAt });
    await backfillPlayerProfilesMigration.up(db);
    const before = await profiles.find({}).toArray();

    await backfillPlayerProfilesMigration.up(db);

    expect(await profiles.find({}).toArray()).toEqual(before);
  });

  it("leaves the user document unchanged", async () => {
    const { db, users } = await collections();
    const _id = new ObjectId();
    await users.insertOne({ _id, level: 3, xp: 200, streak: 4, stamina: 60, createdAt });
    const before = await users.findOne({ _id });

    await backfillPlayerProfilesMigration.up(db);

    expect(await users.findOne({ _id })).toEqual(before);
  });

  it("flushes across the batch boundary", async () => {
    const { db, users, profiles } = await collections();
    await users.insertMany(Array.from({ length: 501 }, () => ({ _id: new ObjectId(), level: 1, xp: 0, streak: 0, createdAt })));

    await backfillPlayerProfilesMigration.up(db);

    expect(await profiles.countDocuments({})).toBe(501);
  });
});
