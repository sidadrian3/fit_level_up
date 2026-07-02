import { ObjectId } from "mongodb";
import type { Quest, QuestCategory, QuestMetric } from "@/lib/types";
import { getCollection } from "@/lib/data/get-collection";
import { ClientSession } from "mongodb";


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

export async function bulkInsertUserQuestsToDb(
  docs: Omit<UserQuestMongoDoc, "_id">[],
  session?: ClientSession
): Promise<void> {
  if (docs.length === 0) return;
  const collection = await getCollection<UserQuestMongoDoc>("userQuestsCollection");
  await collection.insertMany(docs, { session });
}

export async function getQuestTemplatesByMetricsFromDb(metrics: QuestMetric[]): Promise<QuestTemplateMongoDoc[]> {
  const collection = await getCollection<QuestTemplateMongoDoc>("questTemplatesCollection");
  return collection.find({ isActive: true, metric: { $in: metrics } }).toArray();
}

export async function getActiveQuestTemplatesFromDb(): Promise<QuestTemplateMongoDoc[]> {
  const collection = await getCollection<QuestTemplateMongoDoc>("questTemplatesCollection");
  return collection.find({ isActive: true }).toArray();
}

export async function getQuestTemplateByIdFromDb(id: string): Promise<QuestTemplateMongoDoc | null> {
  const collection = await getCollection<QuestTemplateMongoDoc>("questTemplatesCollection");
  return collection.findOne({ _id: new ObjectId(id) });
}

export async function getQuestTemplatesByMetricFromDb(metric: QuestMetric): Promise<QuestTemplateMongoDoc[]> {
  const collection = await getCollection<QuestTemplateMongoDoc>("questTemplatesCollection");
  return collection.find({ isActive: true, metric }).toArray();
}

export async function findUserQuestFromDb(
  userId: string,
  questTemplateId: string,
  periodStart: string,
  periodEnd: string
): Promise<UserQuestMongoDoc | null> {
  const collection = await getCollection<UserQuestMongoDoc>("userQuestsCollection");
  return collection.findOne({ userId, questTemplateId, periodStart, periodEnd });
}

export async function getUserQuestByIdFromDb(id: string, userId: string): Promise<UserQuestMongoDoc | null> {
  const collection = await getCollection<UserQuestMongoDoc>("userQuestsCollection");
  return collection.findOne({ _id: new ObjectId(id), userId });
}

export async function insertUserQuestToDb(doc: Omit<UserQuestMongoDoc, "_id">, session?: ClientSession): Promise<void> {
  const collection = await getCollection<UserQuestMongoDoc>("userQuestsCollection");
  await collection.insertOne(doc, { session });
}

export async function getUserQuestsForUserFromDb(userId: string): Promise<UserQuestMongoDoc[]> {
  const collection = await getCollection<UserQuestMongoDoc>("userQuestsCollection");
  return collection.find({ userId }).toArray();
}

export async function getQuestTemplatesByIdsFromDb(ids: string[]): Promise<QuestTemplateMongoDoc[]> {
  const collection = await getCollection<QuestTemplateMongoDoc>("questTemplatesCollection");
  return collection.find({ _id: { $in: ids.map(id => new ObjectId(id)) } }).toArray();
}

export async function updateUserQuestProgressInDb(id: string, progress: number, completed: boolean, session?: ClientSession): Promise<void> {
  const collection = await getCollection<UserQuestMongoDoc>("userQuestsCollection");
  await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { progress, completed },
    },
    { session }
  );
}

export async function markUserQuestClaimedInDb(id: string, session?: ClientSession): Promise<void> {
  const collection = await getCollection<UserQuestMongoDoc>("userQuestsCollection");
  await collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { claimed: true },
    },
    { session }
  );
}
