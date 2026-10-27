import type { CreateRunInput, Run } from "@/shared/contracts/run";
import { GAME_CONFIG } from "@/server/platform/config";
import { DomainError } from "@/server/platform/domain";
import { calcStaminaCost, calcExhaustionDebuff } from "../stamina.rules";


export function validateRunInput(input: CreateRunInput): void {
    if (input.distance <= 0) {
        throw new DomainError("invalid", "Distance must be greater than 0");
    }

    if (input.duration <= 0) {
        throw new DomainError("invalid", "Duration must be greater than 0");
    }

}

export function calcRunXP(distance: number, duration: number, difficulty: Run["difficulty"]): number {
    const baseXp = Math.round(
        (distance * GAME_CONFIG.xp.run.distanceMultiplier) +
        (duration * GAME_CONFIG.xp.run.durationMultiplier)
    );
    const difficultyMultiplier = GAME_CONFIG.runDifficultyMultipliers[difficulty];
    return Math.round(baseXp * difficultyMultiplier);
}

export function calcPace(distance: number, duration: number): number {
    return duration / distance;
}

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

    return { baseXpEarned, pace, staminaCost, finalXpEarned };
}
