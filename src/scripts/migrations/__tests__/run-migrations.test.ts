import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { COLLECTIONS, getDb } from "@/server/platform/database";
import { runMigrations, shouldRunMigrations, type Migration } from "../run-migrations";

async function clearRecords() {
  const db = await getDb();
  await db.collection(COLLECTIONS.schemaMigrations).deleteMany({ _id: { $in: ["test-a", "test-b", "test-boom"] } as never });
}

describe("runMigrations", () => {
  beforeEach(clearRecords);
  afterAll(clearRecords);

  it("runs pending migrations in order and records them", async () => {
    const db = await getDb();
    const order: string[] = [];
    const migrations: Migration[] = [
      { name: "test-a", up: async () => void order.push("test-a") },
      { name: "test-b", up: async () => void order.push("test-b") },
    ];

    expect(await runMigrations(db, migrations)).toEqual(["test-a", "test-b"]);
    expect(order).toEqual(["test-a", "test-b"]);

    const records = await db
      .collection<{ _id: string; appliedAt: Date }>(COLLECTIONS.schemaMigrations)
      .find({ _id: { $in: ["test-a", "test-b"] } })
      .toArray();
    expect(records).toHaveLength(2);
    expect(records[0].appliedAt).toBeInstanceOf(Date);
  });

  it("runs nothing on a second call", async () => {
    const db = await getDb();
    const migrations: Migration[] = [{ name: "test-a", up: async () => undefined }];
    await runMigrations(db, migrations);
    expect(await runMigrations(db, migrations)).toEqual([]);
  });

  it("does not record a failing migration and stops the run", async () => {
    const db = await getDb();
    const migrations: Migration[] = [
      { name: "test-boom", up: async () => { throw new Error("boom"); } },
      { name: "test-b", up: async () => undefined },
    ];

    await expect(runMigrations(db, migrations)).rejects.toThrow("boom");
    expect(await db.collection(COLLECTIONS.schemaMigrations).countDocuments({ _id: { $in: ["test-boom", "test-b"] } as never })).toBe(0);
  });
});

describe("shouldRunMigrations", () => {
  it.each([
    [undefined, true],
    ["production", true],
    ["preview", false],
    ["development", false],
  ])("VERCEL_ENV=%s -> %s", (vercelEnv, expected) => {
    expect(shouldRunMigrations(vercelEnv)).toBe(expected);
  });
});
