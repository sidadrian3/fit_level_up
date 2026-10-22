import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prepareUniqueIndexes } from "../prepare-unique-indexes";
import { applySchema, COLLECTIONS, getCollection, getDb } from "@/server/platform/database";

const userId = "prep-user";
const earlier = new Date("2026-01-01");
const later = new Date("2026-02-01");

async function clearAll() {
  for (const key of ["userAchievements", "customExercises", "userQuests", "friendships"] as const) {
    await (await getCollection(key)).deleteMany({});
  }
}

// Recreate the pre-fix state: the unique indexes do not exist yet, so duplicates can be inserted
async function dropUniqueIndexes() {
  const db = await getDb();
  const drops: Array<[string, string]> = [
    [COLLECTIONS.userAchievements, "idx_userAchievements_unique"],
    [COLLECTIONS.customExercises, "idx_customExercises_unique"],
    [COLLECTIONS.friendships, "idx_friendships_pairKey"],
    [COLLECTIONS.userQuests, "idx_userQuests_sync_lookup"],
  ];
  for (const [collection, index] of drops) {
    await db.collection(collection).dropIndex(index).catch(() => undefined);
  }
  await db.collection(COLLECTIONS.userQuests).createIndex(
    { userId: 1, questTemplateId: 1, periodStart: 1, periodEnd: 1 },
    { name: "idx_userQuests_sync_lookup" }
  );
}

describe("prepareUniqueIndexes", () => {
  beforeEach(async () => {
    await clearAll();
    await dropUniqueIndexes();
  });

  afterAll(async () => {
    await clearAll();
    await applySchema(await getDb());
  });

  it("removes duplicates, backfills pairKey, and lets every unique index build", async () => {
    const unlocks = await getCollection("userAchievements");
    await unlocks.insertMany([
      { userId, achievementId: "a", unlockedDate: "2026-01-02" },
      { userId, achievementId: "a", unlockedDate: "2026-01-01" },
      { userId, achievementId: "b", unlockedDate: "2026-01-01" },
    ]);
    const exercises = await getCollection("customExercises");
    await exercises.insertMany([
      { userId, name: "Foo", targetMuscle: "Chest" },
      { userId, name: "Foo", targetMuscle: "Chest" },
      { userId, name: "Foo", targetMuscle: "Back" },
    ]);
    const quests = await getCollection("userQuests");
    const period = { userId, questTemplateId: "t", target: 3, periodStart: "2026-01-05", periodEnd: "2026-01-11" };
    await quests.insertMany([
      { ...period, progress: 1, completed: false, claimed: false },
      { ...period, progress: 3, completed: true, claimed: false },
    ]);
    const friendships = await getCollection("friendships");
    await friendships.insertMany([
      { requesterId: "u1", receiverId: "u2", status: "declined", createdAt: later, updatedAt: later },
      { requesterId: "u2", receiverId: "u1", status: "accepted", createdAt: earlier, updatedAt: earlier },
      { requesterId: "u3", receiverId: "u4", status: "declined", createdAt: earlier, updatedAt: earlier },
      { requesterId: "u4", receiverId: "u3", status: "pending", createdAt: later, updatedAt: later },
      { requesterId: "u5", receiverId: "u6", status: "pending", createdAt: later, updatedAt: later },
    ]);

    await prepareUniqueIndexes();
    await applySchema(await getDb());

    expect(await unlocks.find({ userId, achievementId: "a" }).toArray()).toMatchObject([{ unlockedDate: "2026-01-01" }]);
    expect(await unlocks.countDocuments({})).toBe(2);
    expect(await exercises.countDocuments({})).toBe(2);
    expect(await quests.find({}).toArray()).toMatchObject([{ progress: 3 }]);

    const merged = await friendships.find({}).sort({ pairKey: 1 }).toArray();
    expect(merged.map(f => [f.pairKey, f.status])).toEqual([
      ["u1:u2", "accepted"],
      ["u3:u4", "pending"],
      ["u5:u6", "pending"],
    ]);
  });

  it("is safe to run twice", async () => {
    const friendships = await getCollection("friendships");
    await friendships.insertOne({ requesterId: "u1", receiverId: "u2", status: "pending", createdAt: later, updatedAt: later });

    await prepareUniqueIndexes();
    await applySchema(await getDb());
    await prepareUniqueIndexes();

    expect(await friendships.countDocuments({})).toBe(1);
  });
});
