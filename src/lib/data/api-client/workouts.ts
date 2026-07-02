import type { Workout, CreateWorkoutInput } from "@/lib/types";
import { apiFetch, apiFetchAndNotify } from "./api-fetch";

export async function getWorkouts(page = 1, limit = 5): Promise<readonly Workout[]> {
  return apiFetch<readonly Workout[]>(`/api/workouts?page=${page}&limit=${limit}`);
}

export async function createWorkout(
  input: CreateWorkoutInput,
): Promise<Workout> {
  return apiFetchAndNotify<Workout>("/api/workouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteWorkout(id: string): Promise<boolean> {
  await apiFetch<unknown>(`/api/workouts/${id}`, { method: "DELETE" });
  return true;
}

export async function updateWorkout(
  id: string,
  input: CreateWorkoutInput,
): Promise<Workout> {
  return apiFetchAndNotify<Workout>(`/api/workouts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
