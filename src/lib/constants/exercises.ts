import { TargetMuscle } from "@/lib/types";

export interface PredefinedExercise {
    id: string;
    name: string;
    targetMuscle: TargetMuscle;
}

export const PREDEFINED_EXERCISES: PredefinedExercise[] = [
    // Chest
    { id: "bench_press", name: "Bench Press", targetMuscle: TargetMuscle.Chest },
    { id: "incline_bench_press", name: "Incline Bench Press", targetMuscle: TargetMuscle.Chest },
    { id: "push_up", name: "Push Up", targetMuscle: TargetMuscle.Chest },
    { id: "chest_fly", name: "Chest Fly", targetMuscle: TargetMuscle.Chest },

    // Back
    { id: "pull_up", name: "Pull Up", targetMuscle: TargetMuscle.Back },
    { id: "lat_pulldown", name: "Lat Pulldown", targetMuscle: TargetMuscle.Back },
    { id: "barbell_row", name: "Barbell Row", targetMuscle: TargetMuscle.Back },
    { id: "deadlift", name: "Deadlift", targetMuscle: TargetMuscle.Back },

    // Legs
    { id: "squat", name: "Squat", targetMuscle: TargetMuscle.Legs },
    { id: "leg_press", name: "Leg Press", targetMuscle: TargetMuscle.Legs },
    { id: "romanian_deadlift", name: "Romanian Deadlift", targetMuscle: TargetMuscle.Legs },
    { id: "lunges", name: "Lunges", targetMuscle: TargetMuscle.Legs },
    { id: "calf_raises", name: "Calf Raises", targetMuscle: TargetMuscle.Legs },

    // Arms
    { id: "bicep_curl", name: "Bicep Curl", targetMuscle: TargetMuscle.Arms },
    { id: "hammer_curl", name: "Hammer Curl", targetMuscle: TargetMuscle.Arms },
    { id: "tricep_extension", name: "Tricep Extension", targetMuscle: TargetMuscle.Arms },
    { id: "tricep_dips", name: "Tricep Dips", targetMuscle: TargetMuscle.Arms },
    { id: "shoulder_press", name: "Shoulder Press", targetMuscle: TargetMuscle.Arms },
    { id: "lateral_raise", name: "Lateral Raise", targetMuscle: TargetMuscle.Arms },

    // Core
    { id: "plank", name: "Plank", targetMuscle: TargetMuscle.Core },
    { id: "crunches", name: "Crunches", targetMuscle: TargetMuscle.Core },
    { id: "leg_raises", name: "Leg Raises", targetMuscle: TargetMuscle.Core },
    { id: "russian_twists", name: "Russian Twists", targetMuscle: TargetMuscle.Core },

    // Cardio
    { id: "treadmill_run", name: "Treadmill Run", targetMuscle: TargetMuscle.Cardio },
    { id: "cycling", name: "Cycling", targetMuscle: TargetMuscle.Cardio },
    { id: "rowing", name: "Rowing", targetMuscle: TargetMuscle.Cardio },
    { id: "jump_rope", name: "Jump Rope", targetMuscle: TargetMuscle.Cardio },

    // Full Body
    { id: "burpees", name: "Burpees", targetMuscle: TargetMuscle.FullBody },
    { id: "kettlebell_swings", name: "Kettlebell Swings", targetMuscle: TargetMuscle.FullBody },
];
