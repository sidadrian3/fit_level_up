import type { Db } from "mongodb";
import { COLLECTIONS } from "@/server/platform/database";

export interface Migration {
  name: string;
  up(db: Db): Promise<void>;
}

type MigrationRecord = { _id: string; appliedAt: Date };

// Preview deployments share the production database, so only production (or a local run) may migrate it
export function shouldRunMigrations(vercelEnv: string | undefined): boolean {
  return vercelEnv === undefined || vercelEnv === "production";
}

export async function runMigrations(db: Db, migrations: Migration[]): Promise<string[]> {
  const records = db.collection<MigrationRecord>(COLLECTIONS.schemaMigrations);
  const applied = new Set((await records.find({}).toArray()).map((record) => record._id));
  const appliedNow: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    await migration.up(db);
    await records.insertOne({ _id: migration.name, appliedAt: new Date() });
    appliedNow.push(migration.name);
  }
  return appliedNow;
}
