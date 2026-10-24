import type { ClientSession } from "mongodb";
import type { QuestMetric } from "@/lib/types";
import { revokeSource } from "@/server/progression";
import { getPeriodForCategory, periodRange } from "./quest.rules";
import { findQuestRow, setQuestRecount } from "./quest.repository";
import { QUEST_ENTRIES } from "./sync-quests";

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
