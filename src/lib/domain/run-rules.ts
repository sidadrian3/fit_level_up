import type { CreateRunInput, Run } from "@/lib/types";
import { GAME_CONFIG } from "@/lib/config/game-config";


export function validateRunInput(input: CreateRunInput): void {
    if (input.distance <= 0) {
        throw new Error("Distance must be greater than 0");
    }

    if (input.duration <= 0) {
        throw new Error("Duration must be greater than 0");
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
