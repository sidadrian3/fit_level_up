import { CreateWorkoutInput, Exercise } from "@/lib/types";
import { validateWorkoutInput, filterNamedExercises, calcWorkoutXP } from "./workout-rules";
import { calcStaminaCost, calcExhaustionDebuff } from "./stamina-rules";

export interface WorkoutEvaluationResult {
    exercises: Exercise[];
    baseXpEarned: number;
    staminaCost: number;
    finalXpEarned: number;
}

export function evaluateWorkout(input: CreateWorkoutInput, userStamina: number): WorkoutEvaluationResult {
    validateWorkoutInput(input);

    const exercises = filterNamedExercises(input.exercises);
    const baseXpEarned = calcWorkoutXP(input.duration, exercises.length);
    const staminaCost = calcStaminaCost(input.duration);
    
    const finalXpEarned = calcExhaustionDebuff(baseXpEarned, userStamina, staminaCost);

    return {
        exercises,
        baseXpEarned,
        staminaCost,
        finalXpEarned
    };
}
