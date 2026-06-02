import { mockWorkouts } from "@/lib/mock-data";
import type { CreateWorkoutInput, Workout } from "@/lib/types";

/** In-memory list; seeded from mock. Resets when the dev server restarts. */
let workouts: Workout[] = [...mockWorkouts];

export function getAllWorkouts(): Workout[] {
    return workouts;
}

function validateInput(input: CreateWorkoutInput): void {
    if (!input.title.trim()) {
        throw new Error("Title is required");
    }
    if (input.duration <= 0) {
        throw new Error("Duration must be greater than 0");
    }
    const named = input.exercises.filter((ex) => ex.name.trim());
    if (named.length === 0) {
        throw new Error("Add at least one exercise with a name");
    }
}

function calcXpEarned(duration: number, exerciseCount: number): number {
    return Math.round(duration * 2 + exerciseCount * 15);
}

export function addWorkout(input: CreateWorkoutInput): Workout {
    validateInput(input);

    const exercises = input.exercises.filter((ex) => ex.name.trim());

    const workout: Workout = {
        id: `w${Date.now()}`,
        type: input.type,
        title: input.title.trim(),
        exercises,
        duration: input.duration,
        xpEarned: calcXpEarned(input.duration, exercises.length),
        date: new Date().toISOString().slice(0, 10),
    };

    workouts = [workout, ...workouts];
    return workout;
}
