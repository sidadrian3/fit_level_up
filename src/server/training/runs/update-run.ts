import type { CreateRunInput, Run } from "@/lib/types";
import { clientPromise } from "@/server/platform/database";
import { getUserTimeZone } from "@/server/platform/auth";
import { replaceSourceXp } from "@/server/progression";
import { recountQuestProgress } from "@/server/quests";
import { questMeasure } from "../training.adapters";
import { calcPace, calcRunXP, validateRunInput } from "./run.rules";
import { findRunById, updateRunFields } from "./run.repository";

export async function updateRun(id: string, input: CreateRunInput, userId: string): Promise<Run | null> {
    validateRunInput(input);

    const xpEarned = calcRunXP(input.distance, input.duration, input.difficulty);
    const pace = calcPace(input.distance, input.duration);

    const client = await clientPromise;
    const session = client.startSession();
    try {
        return await session.withTransaction(async () => {
            const previous = await findRunById(userId, id, session);
            if (!previous) return null;

            const run = await updateRunFields(userId, id, {
                distance: input.distance,
                duration: input.duration,
                pace,
                difficulty: input.difficulty,
                xpEarned,
            }, session);
            if (!run) return null;

            const occurredAt = new Date(run.date);
            await replaceSourceXp({
                userId,
                source: { type: "run", id: run.id },
                amount: run.xpEarned,
                occurredAt,
                totals: { distanceKm: run.distance - previous.distance },
            }, session);
            await recountQuestProgress(userId, {
                metrics: ["run_distance"],
                occurredAt,
                timeZone: await getUserTimeZone(userId, { session }),
                measure: questMeasure(userId, session),
            }, session);
            return run;
        });
    } finally {
        await session.endSession();
    }
}
