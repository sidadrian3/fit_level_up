import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { Quest, QuestCategory, QuestMetric } from "@/lib/types";

export type QuestTemplateMongoDoc = {
  _id?: ObjectId;
  title: string;
  description: string;
  category: QuestCategory;
  metric: QuestMetric;
  target: number;
  xpReward: number;
  icon: string;
  isActive: boolean;
};

export type UserQuestMongoDoc = {
  _id?: ObjectId;
  userId: string;
  questTemplateId: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  periodStart: string;
  periodEnd: string;
};

export function getDbConfig() {
  const dbName = process.env.MONGODB_DB;
  const questTemplatesCollection =
    process.env.MONGODB_QUEST_TEMPLATES_COLLECTION;
  const userQuestsCollection = process.env.MONGODB_USER_QUESTS_COLLECTION;

  if (!dbName) {
    throw new Error("Missing MONGODB_DB in .env.local");
  }

  if (!questTemplatesCollection) {
    throw new Error("Missing MONGODB_QUEST_TEMPLATES_COLLECTION in .env.local");
  }

  if (!userQuestsCollection) {
    throw new Error("Missing MONGODB_USER_QUESTS_COLLECTION in .env.local");
  }

  return {
    dbName,
    questTemplatesCollection,
    userQuestsCollection,
  };
}

export function toQuestView(
  userQuest: UserQuestMongoDoc,
  template: QuestTemplateMongoDoc
): Quest {
  if (!userQuest._id) {
    throw new Error("User quest document is missing _id");
  }

  return {
    id: userQuest._id.toString(),
    title: template.title,
    description: template.description,
    category: template.category,
    progress: userQuest.progress,
    target: userQuest.target,
    xpReward: template.xpReward,
    completed: userQuest.completed,
    claimed: userQuest.claimed,
    icon: template.icon,
  };
}

export async function getActiveQuestTemplatesFromDb(): Promise<QuestTemplateMongoDoc[]> {
  const { dbName, questTemplatesCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<QuestTemplateMongoDoc>(questTemplatesCollection);
  return collection.find({ isActive: true }).toArray();
}

export async function getQuestTemplateByIdFromDb(id: string): Promise<QuestTemplateMongoDoc | null> {
  const { dbName, questTemplatesCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<QuestTemplateMongoDoc>(questTemplatesCollection);
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function getQuestTemplatesByMetricFromDb(metric: QuestMetric): Promise<QuestTemplateMongoDoc[]> {
  const { dbName, questTemplatesCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<QuestTemplateMongoDoc>(questTemplatesCollection);
  return collection.find({ isActive: true, metric }).toArray();
}

export async function findUserQuestFromDb(
  userId: string,
  questTemplateId: string,
  periodStart: string,
  periodEnd: string
): Promise<UserQuestMongoDoc | null> {
  const { dbName, userQuestsCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<UserQuestMongoDoc>(userQuestsCollection);
  return collection.findOne({ userId, questTemplateId, periodStart, periodEnd });
}

export async function getUserQuestByIdFromDb(id: string, userId: string): Promise<UserQuestMongoDoc | null> {
  const { dbName, userQuestsCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<UserQuestMongoDoc>(userQuestsCollection);
  return collection.findOne({ _id: new ObjectId(id), userId });
}

export async function insertUserQuestToDb(doc: Omit<UserQuestMongoDoc, "_id">): Promise<void> {
  const { dbName, userQuestsCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<UserQuestMongoDoc>(userQuestsCollection);
  await collection.insertOne(doc);
}

export async function getUserQuestsForUserFromDb(userId: string): Promise<UserQuestMongoDoc[]> {
  const { dbName, userQuestsCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<UserQuestMongoDoc>(userQuestsCollection);
  return collection.find({ userId }).toArray();
}

export async function getQuestTemplatesByIdsFromDb(ids: string[]): Promise<QuestTemplateMongoDoc[]> {
  const { dbName, questTemplatesCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<QuestTemplateMongoDoc>(questTemplatesCollection);
  return collection.find({ _id: { $in: ids.map(id => new ObjectId(id)) } }).toArray();
}

export async function updateUserQuestProgressInDb(id: string, progress: number, completed: boolean): Promise<void> {
  const { dbName, userQuestsCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<UserQuestMongoDoc>(userQuestsCollection);
  await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { progress, completed },
    }
  );
}

export async function markUserQuestClaimedInDb(id: string): Promise<void> {
  const { dbName, userQuestsCollection } = getDbConfig();
  const client = await clientPromise;
  const collection = client.db(dbName).collection<UserQuestMongoDoc>(userQuestsCollection);
  await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { claimed: true },
    }
  );
}
