import { z } from "zod";

export const CreateRunSchema = z.object({
  distance: z.number().positive("Distance must be greater than 0").max(1000),
  duration: z.number().positive("Duration must be greater than 0").max(1440),
  difficulty: z.enum(["easy", "moderate", "hard", "intense"]),
  idempotencyKey: z.uuid(),
});
