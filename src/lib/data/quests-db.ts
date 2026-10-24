import type { ClientSession, ObjectId } from "mongodb";
import { getCollection, parseObjectId, type UserQuestDoc } from "@/server/platform/database";

export async function findUserQuestFromDb(
  userId: string,
  questTemplateId: string,
  periodStart: string | null,
  periodEnd: string | null,
): Promise<UserQuestDoc | null> {
  const collection = await getCollection<UserQuestDoc>(
    "userQuests",
  );
  return collection.findOne({
    userId,
    questTemplateId,
    periodStart,
    periodEnd,
  });
}

export async function getUserQuestByIdFromDb(
  id: string,
  userId: string,
): Promise<UserQuestDoc | null> {
  const _id = parseObjectId(id);
  if (!_id) return null;
  const collection = await getCollection<UserQuestDoc>(
    "userQuests",
  );
  return collection.findOne({ _id, userId });
}

export async function insertUserQuestToDb(
  doc: Omit<UserQuestDoc, "_id">,
  session?: ClientSession,
): Promise<void> {
  const collection = await getCollection<UserQuestDoc>(
    "userQuests",
  );
  await collection.insertOne(doc, { session });
}

export async function getUserQuestsForUserFromDb(
  userId: string,
  today: string,
  session?: ClientSession,
): Promise<UserQuestDoc[]> {
  const collection = await getCollection<UserQuestDoc>(
    "userQuests",
  );
  return collection
    .find(
      {
        userId,
        $or: [{ periodEnd: { $gte: today } }, { periodEnd: null }],
      },
      { session },
    )
    .toArray();
}

export async function updateUserQuestProgressInDb(
  id: ObjectId,
  userId: string,
  progress: number,
  completed: boolean,
  session?: ClientSession,
): Promise<void> {
  const collection = await getCollection<UserQuestDoc>(
    "userQuests",
  );
  await collection.updateOne(
    { _id: id, userId },
    {
      $set: { progress, completed },
    },
    { session },
  );
}

export async function markUserQuestClaimedInDb(
  id: ObjectId,
  userId: string,
  session?: ClientSession,
): Promise<number> {
  const collection = await getCollection<UserQuestDoc>(
    "userQuests",
  );
  const result = await collection.updateOne(
    { _id: id, userId, claimed: false },
    {
      $set: { claimed: true },
    },
    { session },
  );
  return result.modifiedCount;
}

export async function bulkUpsertUserQuestsToDb(
  docs: Omit<UserQuestDoc, "_id">[],
  session?: ClientSession,
): Promise<void> {
  if (docs.length === 0) return;
  const collection = await getCollection<UserQuestDoc>(
    "userQuests",
  );

  const operations = docs.map((doc) => ({
    updateOne: {
      filter: {
        userId: doc.userId,
        questTemplateId: doc.questTemplateId,
        periodStart: doc.periodStart,
        periodEnd: doc.periodEnd,
      },
      update: { $setOnInsert: doc },
      upsert: true,
    },
  }));
  await collection.bulkWrite(operations, { session });
}
