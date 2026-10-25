import { clientPromise } from "@/server/platform/database";
import { emit } from "@/server/platform/events";
import { getUserTimeZone } from "@/server/platform/auth";
import { revokeSource } from "@/server/progression";
import { recountQuestProgress } from "@/server/quests";
import { activityDays, questMeasure } from "../training.adapters";
import { deleteRunById } from "./run.repository";

export async function deleteRun(userId: string, runId: string): Promise<boolean> {
    const client = await clientPromise;
    const session = client.startSession();
    try {
        return await session.withTransaction(async () => {
            const run = await deleteRunById(userId, runId, session);
            if (!run) return false;

            const occurredAt = new Date(run.date);
            const timeZone = await getUserTimeZone(userId, { session });
            await revokeSource({
                userId,
                source: { type: "run", id: run.id },
                occurredAt,
                totals: { distanceKm: -run.distance },
                activityDays: activityDays(userId, timeZone, session),
            }, session);
            await recountQuestProgress(userId, {
                metrics: ["run_count", "run_distance"],
                occurredAt,
                timeZone,
                measure: questMeasure(userId, session),
            }, session);
            await emit("activity.reverted", { userId, activity: { type: "run", id: run.id } }, { session });
            return true;
        });
    } finally {
        await session.endSession();
    }
}
