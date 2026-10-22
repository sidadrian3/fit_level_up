import type { Db } from "mongodb";
import { COLLECTIONS, RETIRED_INDEXES, SCHEMA } from "./schema";

async function collectionExists(db: Db, name: string): Promise<boolean> {
    return (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
}

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
        await db.collection(name).createIndexes(indexes);
    }

    for (const { collection, name } of RETIRED_INDEXES) {
        const target = db.collection(COLLECTIONS[collection]);
        if (await target.indexExists(name)) {
            await target.dropIndex(name);
        }
    }
}
