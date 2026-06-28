// PURE FUNCTIONS — no imports from infrastructure, no database, no process.env

import type { CreateWorkoutInput, Exercise } from "@/lib/types";

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

export function calcWorkoutXP(duration: number, exerciseCount: number): number {
    return Math.round(duration * 2 + exerciseCount * 15);
}
