import type { Db, ObjectId } from "mongodb";
import { COLLECTIONS, SCHEMA, collectionExists, isDuplicateKeyError } from "@/server/platform/database";
import { QUEST_DEFINITIONS } from "@/server/quests";
import type { Migration } from "./run-migrations";

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/;
const ALL_TIME = "all-time";

type LegacyQuestTemplate = { _id: ObjectId; title: string };

type LegacyUserQuest = {
  _id: ObjectId;
  questTemplateId: string;
  periodStart: string | null;
  periodEnd: string | null;
};

async function loadQuestIdsByTemplateId(db: Db): Promise<Map<string, string>> {
  const questIdsByTitle = new Map<string, string>(Object.entries(QUEST_DEFINITIONS).map(([id, definition]) => [definition.legacyTitle, id]));
  const questIdsByTemplateId = new Map<string, string>();
  const templates = db.collection<LegacyQuestTemplate>(COLLECTIONS.questTemplates).find({}, { projection: { title: 1 } });
  for await (const template of templates) {
    const questId = questIdsByTitle.get(template.title);
    if (questId) questIdsByTemplateId.set(template._id.toString(), questId);
  }
  return questIdsByTemplateId;
}

// Runs before applySchema, so it loosens the validator itself before writing null periods
async function allowNullPeriods(db: Db): Promise<void> {
  await db.command({
    collMod: COLLECTIONS.userQuests,
    validator: SCHEMA.userQuests.validator,
    validationLevel: "moderate",
    validationAction: "error",
  });
}

async function migrateQuestIds(db: Db): Promise<void> {
  if (!(await collectionExists(db, COLLECTIONS.userQuests))) return;
  await allowNullPeriods(db);

  const questIdsByTemplateId = await loadQuestIdsByTemplateId(db);
  const userQuests = db.collection<LegacyUserQuest>(COLLECTIONS.userQuests);
  const stale = userQuests.find({
    $or: [
      { questTemplateId: { $regex: OBJECT_ID_PATTERN } },
      { periodStart: ALL_TIME },
      { periodEnd: ALL_TIME },
    ],
  });

  let remapped = 0;
  let dropped = 0;
  for await (const row of stale) {
    const isLegacyId = OBJECT_ID_PATTERN.test(row.questTemplateId);
    const questId = isLegacyId ? questIdsByTemplateId.get(row.questTemplateId) : row.questTemplateId;
    if (!questId) {
      await userQuests.deleteOne({ _id: row._id });
      dropped += 1;
      continue;
    }

    const isAllTime = row.periodStart === ALL_TIME || row.periodEnd === ALL_TIME;
    try {
      await userQuests.updateOne(
        { _id: row._id },
        { $set: { questTemplateId: questId, ...(isAllTime && { periodStart: null, periodEnd: null }) } }
      );
      remapped += 1;
    } catch (error) {
      if (!isDuplicateKeyError(error, "questTemplateId")) throw error;
      await userQuests.deleteOne({ _id: row._id });
      dropped += 1;
    }
  }

  console.log(`Migrated ${remapped} user quests, dropped ${dropped} unmappable or duplicate rows.`);
}

export const questIdsAndAllTimePeriodsMigration: Migration = {
  name: "004-quest-ids-and-all-time-periods",
  up: migrateQuestIds,
};
