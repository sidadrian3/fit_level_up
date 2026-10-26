import { QUEST_DEFINITIONS, getQuestDefinition, type QuestId } from "./quest.definitions";
import {
  calcNextProgress,
  getPeriodForCategory,
  getQuestProgressUpdates,
  periodRange,
  validateQuestClaim,
  type QuestCalendar,
} from "./quest.rules";
import {
  findActiveQuests,
  findQuestById,
  findQuestRow,
  markQuestClaimed,
  setQuestProgress,
  setQuestRecount,
  upsertQuestRows,
} from "./quest.repository";
import type { ClientSession } from "mongodb";
import type { Quest } from "@/shared/contracts/quest";
import type { QuestActivity, QuestMetric } from "./quest.rules";
import { toLocalDay } from "@/shared/time/calendar";
import { getUserTimeZone } from "@/server/platform/auth";
import { clientPromise, type UserQuestDoc } from "@/server/platform/database";
import { grantXp, revokeSource, type PlayerState } from "@/server/progression";
import { ConflictError, NotFoundError } from "@/server/platform/http";

type QuestEntry = { id: QuestId } & ReturnType<typeof getQuestDefinition>;

const QUEST_ENTRIES: QuestEntry[] = (Object.keys(QUEST_DEFINITIONS) as QuestId[]).map((id) => ({
  id,
  ...getQuestDefinition(id),
}));

// Rows persist the definition id as a plain string, so lookups from stored data go through a string-keyed map
const QUEST_ENTRY_BY_ID: ReadonlyMap<string, QuestEntry> = new Map(QUEST_ENTRIES.map((entry) => [entry.id, entry]));

// Idempotent: $setOnInsert never touches a row that already exists
async function ensureQuestRows(
  userId: string,
  entries: QuestEntry[],
  calendar: QuestCalendar,
  session?: ClientSession
): Promise<void> {
  const rows = entries.map((entry) => {
    const { periodStart, periodEnd } = getPeriodForCategory(entry.category, calendar.now, calendar.timeZone);

    return {
      questTemplateId: entry.id,
      progress: 0,
      target: entry.target,
      completed: false,
      claimed: false,
      periodStart,
      periodEnd,
    };
  });

  await upsertQuestRows(userId, rows, session);
}

async function syncQuests(userId: string, calendar: QuestCalendar): Promise<void> {
  await ensureQuestRows(userId, QUEST_ENTRIES, calendar);
}

function toQuestView(id: string, userQuest: UserQuestDoc, entry: QuestEntry): Quest {
  return {
    id,
    title: entry.title,
    description: entry.description,
    category: entry.category,
    progress: userQuest.progress,
    target: userQuest.target,
    xpReward: entry.xpReward,
    completed: userQuest.completed,
    claimed: userQuest.claimed,
    icon: entry.icon,
  };
}

export async function getQuests(userId: string): Promise<Quest[]> {
  const calendar = { now: new Date(), timeZone: await getUserTimeZone(userId) };
  await syncQuests(userId, calendar);

  const userQuests = await findActiveQuests(userId, toLocalDay(calendar.now, calendar.timeZone));

  const quests: Quest[] = [];
  for (const userQuest of userQuests) {
    const entry = QUEST_ENTRY_BY_ID.get(userQuest.questTemplateId);
    if (!entry) continue;
    quests.push(toQuestView(userQuest._id.toString(), userQuest, entry));
  }
  return quests;
}

export async function claimQuest(userId: string, questId: string): Promise<{ player: PlayerState; leveledUp: boolean } | undefined> {
  await syncQuests(userId, { now: new Date(), timeZone: await getUserTimeZone(userId) });

  const quest = await findQuestById(userId, questId);

  if (!quest) {
    throw new NotFoundError("Quest not found");
  }

  validateQuestClaim({ completed: quest.completed, claimed: quest.claimed });

  const client = await clientPromise;
  const session = client.startSession();

  try {
    return await session.withTransaction(async () => {
      const claimedNow = await markQuestClaimed(userId, quest, session);

      if (!claimedNow) {
        throw new ConflictError("Quest already claimed");
      }

      const entry = QUEST_ENTRY_BY_ID.get(quest.questTemplateId);
      if (entry) {
        return await grantXp({
          userId,
          source: { type: "quest_claim", id: quest._id.toString() },
          amount: entry.xpReward,
          occurredAt: new Date(),
        }, session);
      }
    });
  } finally {
    await session.endSession();
  }
}

// The session is required: read-then-write is only race-free because a conflicting transaction is aborted and retried
export async function updateQuestProgress(
  userId: string,
  activity: QuestActivity,
  calendar: QuestCalendar,
  session: ClientSession
): Promise<void> {

  const updates = getQuestProgressUpdates(activity);
  const metrics = new Set(updates.map(u => u.metric));

  const matchingEntries = QUEST_ENTRIES.filter(entry => metrics.has(entry.metric));
  await ensureQuestRows(userId, matchingEntries, calendar, session);
  const userQuests = await findActiveQuests(userId, toLocalDay(calendar.now, calendar.timeZone), session);

  for (const update of updates) {
    for (const entry of matchingEntries.filter(e => e.metric === update.metric)) {
      const { periodStart, periodEnd } = getPeriodForCategory(entry.category, calendar.now, calendar.timeZone);

      const userQuest = userQuests.find(uq =>
        uq.questTemplateId === entry.id &&
        uq.periodStart === periodStart &&
        uq.periodEnd === periodEnd
      );

      if (!userQuest || userQuest.completed) {
        continue;
      }

      const nextProgress = calcNextProgress(userQuest.progress, update.amount, userQuest.target);
      const isCompleted = nextProgress >= userQuest.target;

      await setQuestProgress(userId, userQuest._id.toString(), nextProgress, isCompleted, session);
    }
  }
}

export type QuestMeasure = (
  metric: QuestMetric,
  range: { from: Date; toExclusive: Date } | null,
) => Promise<number>;

type RecountInput = {
  metrics: QuestMetric[];
  occurredAt: Date;
  timeZone: string;
  measure: QuestMeasure;
};

// Rows are never created: a period nobody played in has nothing to correct. Runs sequentially inside the caller's transaction.
export async function recountQuestProgress(
  userId: string,
  { metrics, occurredAt, timeZone, measure }: RecountInput,
  session: ClientSession,
): Promise<void> {
  for (const entry of QUEST_ENTRIES.filter((e) => metrics.includes(e.metric))) {
    const period = getPeriodForCategory(entry.category, occurredAt, timeZone);
    const row = await findQuestRow(userId, { questTemplateId: entry.id, ...period }, session);
    if (!row) continue;

    const measured = await measure(entry.metric, periodRange(period, timeZone));
    const progress = Math.min(measured, row.target);
    const completed = progress >= row.target;
    const clawBack = row.claimed && !completed;

    if (clawBack) {
      await revokeSource(
        {
          userId,
          source: { type: "quest_claim", id: row._id.toString() },
          occurredAt: new Date(),
          totals: {},
        },
        session,
      );
    }

    await setQuestRecount(
      userId,
      row._id.toString(),
      { progress, completed, claimed: row.claimed && !clawBack },
      session,
    );
  }
}
