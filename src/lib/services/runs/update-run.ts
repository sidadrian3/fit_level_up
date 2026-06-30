import type { CreateRunInput, Run } from "@/lib/types";
import { updateRunInDb } from "@/lib/data/runs-db";
import {
    validateRunInput,
    calcRunXP,
    calcPace,
} from "@/lib/domain/run-rules";

export async function updateRun(
    id: string,
    input: CreateRunInput,
    userId: string
): Promise<Run | null> {
    // 1. Domain validation (pure)
    validateRunInput(input);

    // 2. Domain calculation (pure)
    const xpEarned = calcRunXP(input.distance, input.duration, input.difficulty);
    const pace = calcPace(input.distance, input.duration);

    // 3. Persistence — pass pre-built fields, DB just writes
    return updateRunInDb(id, {
        distance: input.distance,
        duration: input.duration,
        pace,
        difficulty: input.difficulty,
        xpEarned,
    }, userId);
}
