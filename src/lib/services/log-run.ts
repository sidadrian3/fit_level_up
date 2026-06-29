import type { CreateRunInput, Run } from "@/lib/types";
import { updateQuestProgress } from "@/lib/services/update-quest-progress";
import { grantXP, updateUserStats } from "@/lib/data/user-db";
import { evaluateAchievements } from "@/lib/data/achievements-db";
import { insertRun } from "@/lib/data/runs-db";
import {
    validateRunInput,
    calcRunXP,
    calcPace,
} from "@/lib/domain/run-rules";


export async function logRun(
    input: CreateRunInput,
    userId: string
): Promise<Run> {

    // 1. Domain validation (pure)
    validateRunInput(input);

    // 2. Domain calculation (pure)
    const xpEarned = calcRunXP(input.distance, input.duration, input.difficulty);
    const pace = calcPace(input.distance, input.duration);

    // 3. Persistence — pass pre-built fields, DB just writes
    const run = await insertRun({
        userId,
        distance: input.distance,
        duration: input.duration,
        pace,
        difficulty: input.difficulty,
        xpEarned,
        date: new Date().toISOString().slice(0, 10),
    });


    // 4. Side-effects (explicitly orchestrated, easy to extend or skip)
    await updateQuestProgress(userId, {
        type: "run_created",
        distance: run.distance,
        xpEarned: run.xpEarned,
    });
    await grantXP(userId, run.xpEarned);
    await updateUserStats(userId, { incrementDistance: run.distance });
    await evaluateAchievements(userId);

    return run;
}