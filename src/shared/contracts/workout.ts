import { z } from "zod";
import { ExerciseSchema } from "./exercise";

export const CreateWorkoutSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  exercises: z.array(ExerciseSchema).min(1, "At least one exercise is required"),
  duration: z.number().positive("Duration must be greater than 0").max(1440),
  idempotencyKey: z.uuid().optional(),
});
