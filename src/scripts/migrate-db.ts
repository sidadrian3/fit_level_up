import { applySchema, clientPromise, getDb } from "@/server/platform/database";
import { MIGRATIONS, runMigrations, shouldRunMigrations } from "./migrations";

async function main() {
  const vercelEnv = process.env.VERCEL_ENV;
  if (!shouldRunMigrations(vercelEnv)) {
    console.log(`Skipping migrations: VERCEL_ENV=${vercelEnv} shares the production database`);
    process.exit(0);
  }

  console.log("Starting database migrations...");
  try {
    await clientPromise;
    const db = await getDb();
    const applied = await runMigrations(db, MIGRATIONS);
    await applySchema(db);
    console.log(`Database migrations completed successfully. Applied: ${applied.length ? applied.join(", ") : "none"}`);
    process.exit(0);
  } catch (error) {
    console.error("Database migration failed:", error);
    process.exit(1);
  }
}

main();
