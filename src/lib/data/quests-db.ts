import {ObjectId} from "mongodb";
import clientPromise from "@/lib/mongodb";
import type { Quest, QuestCategory, QuestMetric,} from "@/lib/types";

type QuestTemplateMongoDoc = {
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

type UserQuestMongoDoc = {
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

function getDbConfig() {
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

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getMondayDateString(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();

  const diffToMonday = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diffToMonday);

  return current.toISOString().slice(0, 10);
}

function getSundayDateString(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();

  const diffToSunday = day === 0 ? 0 : 7 - day;
  current.setDate(current.getDate() + diffToSunday);

  return current.toISOString().slice(0, 10);
}

function getPeriodForCategory(category: QuestCategory) {
  if (category === "daily") {
    const today = getTodayDateString();

    return {
      periodStart: today,
      periodEnd: today,
    };
  }

  if (category === "weekly") {
    return {
      periodStart: getMondayDateString(),
      periodEnd: getSundayDateString(),
    };
  }

  return {
    periodStart: "all-time",
    periodEnd: "all-time",
  };
}

function toQuestView(
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
    icon: template.icon,
  };
}

export async function ensureUserQuests(userId: string): Promise<void> {
  const {
    dbName,
    questTemplatesCollection,
    userQuestsCollection,
  } = getDbConfig();

  const client = await clientPromise;
  const db = client.db(dbName);

  const templatesCollection =
    db.collection<QuestTemplateMongoDoc>(questTemplatesCollection);

  const userQuests =
    db.collection<UserQuestMongoDoc>(userQuestsCollection);

  const activeTemplates = await templatesCollection
    .find({ isActive: true })
    .toArray();

  for (const template of activeTemplates) {
    if (!template._id) {
      continue;
    }

    const { periodStart, periodEnd } = getPeriodForCategory(template.category);
    const questTemplateId = template._id.toString();

    const existingQuest = await userQuests.findOne({
      userId,
      questTemplateId,
      periodStart,
      periodEnd,
    });

    if (existingQuest) {
      continue;
    }

    await userQuests.insertOne({
      userId,
      questTemplateId,
      progress: 0,
      target: template.target,
      completed: false,
      claimed: false,
      periodStart,
      periodEnd,
    });
  }
}

export async function getUserQuestsFromDb(
  userId: string
): Promise<Quest[]> {
  const {
    dbName,
    questTemplatesCollection,
    userQuestsCollection,
  } = getDbConfig();

  await ensureUserQuests(userId);

  const client = await clientPromise;
  const db = client.db(dbName);

  const templatesCollection =
    db.collection<QuestTemplateMongoDoc>(questTemplatesCollection);

  const userQuestsCollectionRef =
    db.collection<UserQuestMongoDoc>(userQuestsCollection);

  const userQuests = await userQuestsCollectionRef
    .find({ userId })
    .toArray();

  const quests: Quest[] = [];

  for (const userQuest of userQuests) {
    const template = await templatesCollection.findOne({
      _id: new ObjectId(userQuest.questTemplateId),
    });

    if (!template) {
      continue;
    }

    quests.push(toQuestView(userQuest, template));
  }

  return quests;
}
