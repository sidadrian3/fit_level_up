import type { CreateRunInput, Run } from "@/lib/types";
import { recountQuestProgress, updateQuestProgress } from "@/server/quests";
import { getUserTimeZone } from "@/server/platform/auth";
import {
  getPlayerState,
  recordActivity,
  replaceSourceXp,
  revokeSource,
} from "@/server/progression";
import { clientPromise } from "@/server/platform/database";
import { emit } from "@/server/platform/events";
import { createOnce, type IdempotencyRequest, type IdempotentResult } from "@/server/platform/http";
import { calcPace, calcRunXP, evaluateRun, validateRunInput } from "./run.rules";
import {
  deleteRunById,
  findRunById,
  findRunByIdempotencyKey,
  insertRun,
  listRunsPage,
  updateRunFields,
} from "./run.repository";
import { activityDays, questMeasure } from "../training.adapters";
import { aggregateRunStats } from "../runs/run.repository";

export async function logRun(
    input: CreateRunInput,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<IdempotentResult<Run>> {
    return createOnce({
        request: idempotency,
        findExisting: () => findRunByIdempotencyKey(userId, idempotency.key),
        create: () => createRun(input, userId, idempotency),
        reusedMessage: "This run was already saved with your earlier details. Check your history to edit it, or submit again to log a new one.",
    });
}

async function createRun(
    input: CreateRunInput,
    userId: string,
    idempotency: IdempotencyRequest
): Promise<Run> {
    const client = await clientPromise;
    const session = client.startSession();
    try {
        return await session.withTransaction(async () => {
            const now = new Date();
            const player = await getPlayerState(userId, { now, session });
            const timeZone = await getUserTimeZone(userId, { session });
            const evaluation = evaluateRun(input, player.stamina);

            const run = await insertRun({
                userId,
                distance: input.distance,
                duration: input.duration,
                pace: evaluation.pace,
                difficulty: input.difficulty,
                xpEarned: evaluation.finalXpEarned,
                date: now,
                idempotencyKey: idempotency.key,
                idempotencyFingerprint: idempotency.fingerprint,
            }, session);
            await emit("activity.logged", { userId, activity: { type: "run", id: run.id }, occurredAt: now }, { session });

            await updateQuestProgress(userId, {
                type: "run_created",
                distance: run.distance,
                xpEarned: run.xpEarned,
            }, { now, timeZone }, session);

            await recordActivity({
                userId,
                source: { type: "run", id: run.id },
                xp: run.xpEarned,
                staminaCost: evaluation.staminaCost,
                totals: { distanceKm: run.distance },
                occurredAt: now,
            }, session);

            return run;
        });
    } finally {
        await session.endSession();
    }
}

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

export function listRuns(userId: string, page: number, limit: number): Promise<{ data: Run[]; totalCount: number }> {
    return listRunsPage(userId, page, limit);
}

export type RunStats = { totalKm: number; totalRuns: number; avgPace: number };

export async function getRunStats(userId: string): Promise<RunStats> {
    const totals = await aggregateRunStats(userId);
    if (!totals) return { totalKm: 0, totalRuns: 0, avgPace: 0 };

    return {
        totalKm: parseFloat(totals.totalDistance.toFixed(1)),
        totalRuns: totals.totalRuns,
        avgPace: parseFloat((totals.totalPace / totals.totalRuns).toFixed(2)),
    };
}
