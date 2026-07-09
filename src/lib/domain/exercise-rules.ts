import { CustomExercise } from "@/lib/types";
import { PredefinedExercise } from "@/lib/constants/exercises";

/**
 * Pure domain rules for exercises
 */

export function formatExerciseName(name: string): string {
    return name
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

export function mergeAndSortExercises(
    predefined: PredefinedExercise[],
    custom: CustomExercise[]
): Array<PredefinedExercise | CustomExercise> {
    const combined = [...predefined, ...custom];
    
    // Sort alphabetically by name
    return combined.sort((a, b) => a.name.localeCompare(b.name));
}
