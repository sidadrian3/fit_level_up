// PURE FUNCTIONS — no imports from infrastructure, no database, no process.env

import type { CreateWorkoutInput, Exercise } from "@/lib/types";
import { GAME_CONFIG } from "@/lib/config/game-config";

export function validateWorkoutInput(input: CreateWorkoutInput): void {
    if (!input.title.trim()) {
        throw new Error("Title is required");
    }
    if (input.duration <= 0) {
        throw new Error("Duration must be greater than 0");
    }
    const namedExercises = input.exercises.filter((ex) => ex.name.trim());
    if (namedExercises.length === 0) {
        throw new Error("Add at least one exercise with a name");
    }
}

export function filterNamedExercises(exercises: Exercise[]): Exercise[] {
    return exercises.filter((ex) => ex.name.trim());
}

export function calcWorkoutXP(durationMinutes: number, exerciseCount: number): number {
    return (durationMinutes * GAME_CONFIG.xp.workout.durationMultiplier) +
        (exerciseCount * GAME_CONFIG.xp.workout.exerciseMultiplier);
}

