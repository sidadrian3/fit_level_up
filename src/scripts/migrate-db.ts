import { applySchema, clientPromise, getDb } from "@/server/platform/database";
import { prepareUniqueIndexes } from "./prepare-unique-indexes";

async function main() {
  console.log("Starting database migrations...");
  try {
    await clientPromise;
    await prepareUniqueIndexes();
    await applySchema(await getDb());
    console.log("Database migrations completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Database migration failed:", error);
    process.exit(1);
  }
}

main();
