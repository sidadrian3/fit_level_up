import { z } from "zod";
import { TargetMuscle } from "@/lib/types";

// ─── Exercise ───
export const ExerciseSchema = z.object({
  name: z.string(),
  targetMuscle: z.nativeEnum(TargetMuscle),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  weight: z.number().nonnegative().nullable(),
});

// ─── Workout ───
export const CreateWorkoutSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  exercises: z.array(ExerciseSchema).min(1, "At least one exercise is required"),
  duration: z.number().positive("Duration must be greater than 0").max(1440),
  idempotencyKey: z.uuid().optional(),
});

// ─── Run ───
export const CreateRunSchema = z.object({
  distance: z.number().positive("Distance must be greater than 0").max(1000),
  duration: z.number().positive("Duration must be greater than 0").max(1440),
  difficulty: z.enum(["easy", "moderate", "hard", "intense"]),
  idempotencyKey: z.uuid().optional(),
});
