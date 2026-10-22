import { z } from "zod";
import { ExerciseSchema } from "./exercise";

export const WorkoutTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  exercises: z.array(ExerciseSchema).min(1, "At least one exercise is required"),
  idempotencyKey: z.uuid("Invalid idempotency key")
});
