import { ensureIndexes } from "../lib/data/ensure-indexes";
import clientPromise from "../lib/mongodb";

async function main() {
  console.log("Starting database migrations...");
  try {
    await clientPromise;
    await ensureIndexes();
    console.log("Database migrations completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Database migration failed:", error);
    process.exit(1);
  }
}

main();
