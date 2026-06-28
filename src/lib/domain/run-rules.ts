import type { CreateRunInput, Run } from "@/lib/types";

export function validateRunInput(input: CreateRunInput): void {
    if (input.distance <= 0) {
        throw new Error("Distance must be greater than 0");
    }

    if (input.duration <= 0) {
        throw new Error("Duration must be greater than 0");
    }

}

export function calcRunXP(distance: number, duration: number, difficulty: Run["difficulty"]): number {
    const baseXp = Math.round(distance * 10 + duration * 2);
    const difficultyMultiplier = {
        easy: 1,
        moderate: 1.2,
        hard: 1.5,
        intense: 2
    }[difficulty] || 1;
    return Math.round(baseXp * difficultyMultiplier);
}

export function calcPace(distance: number, duration: number): number {
    return duration / distance;
}
