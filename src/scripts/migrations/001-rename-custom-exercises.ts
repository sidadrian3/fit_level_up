import type { Db } from "mongodb";
import { COLLECTIONS } from "@/server/platform/database";
import type { Migration } from "./run-migrations";

const OLD_NAME = "customExercises";

async function collectionExists(db: Db, name: string): Promise<boolean> {
  return (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
}

export const renameCustomExercisesMigration: Migration = {
  name: "001-rename-custom-exercises",
  async up(db) {
    const newName = COLLECTIONS.customExercises;
    if (!(await collectionExists(db, OLD_NAME))) return;

    if (!(await collectionExists(db, newName))) {
      await db.renameCollection(OLD_NAME, newName);
      return;
    }

    if ((await db.collection(OLD_NAME).countDocuments({}, { limit: 1 })) > 0) {
      throw new Error(`Cannot rename ${OLD_NAME} to ${newName}: both collections exist and ${OLD_NAME} still holds documents`);
    }
    await db.collection(OLD_NAME).drop();
  },
};
