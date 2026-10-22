import { z } from "zod";

export enum TargetMuscle {
    Chest = "Chest",
    Back = "Back",
    Legs = "Legs",
    Arms = "Arms",
    Core = "Core",
    Cardio = "Cardio",
    FullBody = "Full Body"
}

export interface Exercise {
    name: string;
    targetMuscle: TargetMuscle;
    sets: number;
    reps: number;
    weight: number | null; // null for bodyweight exercises
}

export const ExerciseSchema = z.object({
  name: z.string(),
  targetMuscle: z.nativeEnum(TargetMuscle),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  weight: z.number().nonnegative().nullable(),
});

export const CreateCustomExerciseSchema = z.object({
  name: z.string().trim().min(1, "Exercise name is required").max(100),
  targetMuscle: z.enum(TargetMuscle),
});
