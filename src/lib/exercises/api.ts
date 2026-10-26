import { apiFetch } from "@/lib/shared/api-fetch";
import type { CreateCustomExerciseInput, CustomExercise } from "@/shared/contracts/exercise";

export async function fetchCustomExercises(): Promise<CustomExercise[]> {
  return apiFetch<CustomExercise[]>("/api/exercises");
}

export async function createCustomExercise(data: CreateCustomExerciseInput): Promise<CustomExercise> {
  return apiFetch<CustomExercise>("/api/exercises", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
