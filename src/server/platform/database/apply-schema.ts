import type { Db } from "mongodb";
import { collectionExists } from "./get-collection";
import { COLLECTIONS, RETIRED_INDEXES, SCHEMA } from "./schema";

export async function applySchema(db: Db): Promise<void> {
    for (const [key, { indexes, validator }] of Object.entries(SCHEMA)) {
        const name = COLLECTIONS[key as keyof typeof SCHEMA];
        const validation = validator
            ? { validator, validationLevel: "moderate", validationAction: "error" }
            : {};
        if (!(await collectionExists(db, name))) {
            await db.createCollection(name, validation);
        } else if (validator) {
            await db.command({ collMod: name, ...validation });
        }
        if (indexes.length > 0) {
            await db.collection(name).createIndexes(indexes);
        }
    }

    for (const { collection, name } of RETIRED_INDEXES) {
        const target = db.collection(COLLECTIONS[collection]);
        if (await target.indexExists(name)) {
            await target.dropIndex(name);
        }
    }
}
