import { z } from "zod";

export const CreateRunSchema = z.object({
  distance: z.number().positive("Distance must be greater than 0").max(1000),
  duration: z.number().positive("Duration must be greater than 0").max(1440),
  difficulty: z.enum(["easy", "moderate", "hard", "intense"]),
});

export type CreateRunInput = z.infer<typeof CreateRunSchema>;

export interface Run {
  id: string;
  distance: number; // km
  duration: number; // minutes
  pace: number; // min/km
  difficulty: "easy" | "moderate" | "hard" | "intense";
  xpEarned: number;
  date: string;
}

export interface RunStats {
  totalKm: number;
  totalRuns: number;
  avgPace: number;
}
