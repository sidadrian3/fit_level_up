import type { CreateRunInput, Run } from "@/lib/types";
import { calcPace, calcRunXP, validateRunInput } from "./run.rules";
import { updateRunFields } from "./run.repository";

export async function updateRun(id: string, input: CreateRunInput, userId: string): Promise<Run | null> {
    validateRunInput(input);

    const xpEarned = calcRunXP(input.distance, input.duration, input.difficulty);
    const pace = calcPace(input.distance, input.duration);

    return updateRunFields(userId, id, {
        distance: input.distance,
        duration: input.duration,
        pace,
        difficulty: input.difficulty,
        xpEarned,
    });
}
