import { TargetMuscle, Workout } from "../types";

export type MuscleIntensity = "inactive" | "low" | "medium" | "high";

export function calcMuscleVolume(workouts: Workout[], days: number): Record<TargetMuscle, MuscleIntensity> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const recentWorkouts = workouts.filter(w => new Date(w.date) >= cutoff);
    
    const counts: Record<TargetMuscle, number> = {
        [TargetMuscle.Chest]: 0,
        [TargetMuscle.Back]: 0,
        [TargetMuscle.Legs]: 0,
        [TargetMuscle.Arms]: 0,
        [TargetMuscle.Core]: 0,
        [TargetMuscle.Cardio]: 0,
        [TargetMuscle.FullBody]: 0,
    };

    for (const w of recentWorkouts) {
        for (const ex of w.exercises) {
            counts[ex.targetMuscle] += (ex.sets * ex.reps);
        }
    }

    const intensities = {} as Record<TargetMuscle, MuscleIntensity>;
    for (const [muscle, count] of Object.entries(counts)) {
        let intensity: MuscleIntensity = "inactive";
        if (count > 0 && count <= 30) intensity = "low";
        else if (count > 30 && count <= 100) intensity = "medium";
        else if (count > 100) intensity = "high";
        
        intensities[muscle as TargetMuscle] = intensity;
    }

    return intensities;
}
