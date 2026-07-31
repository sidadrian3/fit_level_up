import { CreateRunInput } from "@/lib/types";
import { validateRunInput, calcRunXP, calcPace } from "./run-rules";
import { calcStaminaCost, calcExhaustionDebuff } from "./stamina-rules";

export interface RunEvaluationResult {
    baseXpEarned: number;
    pace: number;
    staminaCost: number;
    finalXpEarned: number;
}

export function evaluateRun(input: CreateRunInput, userStamina: number): RunEvaluationResult {
    validateRunInput(input);

    const baseXpEarned = calcRunXP(input.distance, input.duration, input.difficulty);
    const pace = calcPace(input.distance, input.duration);
    const staminaCost = calcStaminaCost(input.duration);
    const finalXpEarned = calcExhaustionDebuff(baseXpEarned, userStamina, staminaCost);

    return {
        baseXpEarned,
        pace,
        staminaCost,
        finalXpEarned
    };
}
