import type { ClientSession } from "mongodb";
import {
  userScopedRepository,
  MAX_FIND_LIMIT,
  type UserOwnedDoc,
  type UserQuestDoc,
} from "@/server/platform/database";

type OwnedQuestDoc = UserQuestDoc & UserOwnedDoc;

export type QuestRow = Omit<UserQuestDoc, "_id" | "userId">;

const quests = userScopedRepository<OwnedQuestDoc>("userQuests");

export function findActiveQuests(userId: string, today: string, session?: ClientSession): Promise<OwnedQuestDoc[]> {
  return quests.find(
    userId,
    { $or: [{ periodEnd: { $gte: today } }, { periodEnd: null }] },
    { limit: MAX_FIND_LIMIT, session },
  );
}

export function findQuestById(userId: string, id: string, session?: ClientSession): Promise<OwnedQuestDoc | null> {
  return quests.findById(userId, id, { session });
}

// $setOnInsert never touches a row that already exists, so a retry is a no-op
export function upsertQuestRows(userId: string, rows: QuestRow[], session?: ClientSession): Promise<void> {
  return quests.upsertMany(
    userId,
    rows.map((row) => ({
      filter: {
        questTemplateId: row.questTemplateId,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
      },
      update: { $setOnInsert: row },
    })),
    { session },
  );
}

export async function setQuestProgress(
  userId: string,
  id: string,
  progress: number,
  completed: boolean,
  session?: ClientSession,
): Promise<void> {
  await quests.updateById(userId, id, { $set: { progress, completed } }, { session });
}

// The `claimed: false` filter makes the flip atomic; false means someone else already claimed it
export async function markQuestClaimed(
  userId: string,
  quest: Pick<UserQuestDoc, "questTemplateId" | "periodStart" | "periodEnd">,
  session?: ClientSession,
): Promise<boolean> {
  const updated = await quests.updateOne(
    userId,
    {
      questTemplateId: quest.questTemplateId,
      periodStart: quest.periodStart,
      periodEnd: quest.periodEnd,
      claimed: false,
    },
    { $set: { claimed: true } },
    { session },
  );
  return updated !== null;
}

export function findQuestRow(
  userId: string,
  period: Pick<UserQuestDoc, "questTemplateId" | "periodStart" | "periodEnd">,
  session?: ClientSession,
): Promise<OwnedQuestDoc | null> {
  return quests.findOne(
    userId,
    {
      questTemplateId: period.questTemplateId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    },
    { session },
  );
}

export async function setQuestRecount(
  userId: string,
  id: string,
  state: Pick<UserQuestDoc, "progress" | "completed" | "claimed">,
  session?: ClientSession,
): Promise<void> {
  await quests.updateById(userId, id, { $set: state }, { session });
}
