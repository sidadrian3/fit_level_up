import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { applySchema, getDb } from "@/server/platform/database";
import { renameCustomExercisesMigration } from "../001-rename-custom-exercises";

const OLD_NAME = "customExercises";
const NEW_NAME = "custom_exercises";

async function dropBoth() {
  const db = await getDb();
  await db.collection(OLD_NAME).drop().catch(() => undefined);
  await db.collection(NEW_NAME).drop().catch(() => undefined);
}

async function exists(name: string) {
  const db = await getDb();
  return (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
}

describe("001-rename-custom-exercises", () => {
  beforeEach(dropBoth);

  afterAll(async () => {
    await dropBoth();
    await applySchema(await getDb());
  });

  it("renames the old collection and keeps its documents", async () => {
    const db = await getDb();
    await db.collection(OLD_NAME).insertOne({ userId: "u", name: "Foo", targetMuscle: "Chest" });

    await renameCustomExercisesMigration.up(db);

    expect(await exists(OLD_NAME)).toBe(false);
    expect(await db.collection(NEW_NAME).countDocuments({})).toBe(1);
  });

  it("drops the old collection when it is empty and the new one exists", async () => {
    const db = await getDb();
    await db.createCollection(OLD_NAME);
    await db.collection(NEW_NAME).insertOne({ userId: "u", name: "Foo", targetMuscle: "Chest" });

    await renameCustomExercisesMigration.up(db);

    expect(await exists(OLD_NAME)).toBe(false);
    expect(await db.collection(NEW_NAME).countDocuments({})).toBe(1);
  });

  it("throws naming both collections when the old one still holds documents", async () => {
    const db = await getDb();
    await db.collection(OLD_NAME).insertOne({ userId: "u", name: "Foo", targetMuscle: "Chest" });
    await db.createCollection(NEW_NAME);

    await expect(renameCustomExercisesMigration.up(db)).rejects.toThrow(
      new RegExp(`${OLD_NAME}.*${NEW_NAME}|${NEW_NAME}.*${OLD_NAME}`)
    );
    expect(await db.collection(OLD_NAME).countDocuments({})).toBe(1);
  });

  it("does nothing when neither or only the new collection exists", async () => {
    const db = await getDb();
    await renameCustomExercisesMigration.up(db);
    expect(await exists(OLD_NAME)).toBe(false);
    expect(await exists(NEW_NAME)).toBe(false);

    await db.collection(NEW_NAME).insertOne({ userId: "u", name: "Foo", targetMuscle: "Chest" });
    await renameCustomExercisesMigration.up(db);
    expect(await db.collection(NEW_NAME).countDocuments({})).toBe(1);
  });
});
