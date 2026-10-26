import { z } from "zod";
import { ExerciseSchema, type Exercise } from "./exercise";

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  exercises: Exercise[];
  createdAt: string;
}

export const WorkoutTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  exercises: z.array(ExerciseSchema).min(1, "At least one exercise is required"),
});

export type CreateWorkoutTemplateInput = z.infer<typeof WorkoutTemplateSchema>;
