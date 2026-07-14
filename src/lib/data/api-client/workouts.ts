import type { Workout, CreateWorkoutInput, PaginatedResponse } from "@/lib/types";
import { apiFetch } from "./api-fetch";

export async function getWorkouts(page = 1, limit = 4): Promise<PaginatedResponse<Workout>> {
  return apiFetch<PaginatedResponse<Workout>>(`/api/workouts?page=${page}&limit=${limit}`);
}

export async function createWorkout(
  input: CreateWorkoutInput,
): Promise<Workout> {
  return apiFetch<Workout>("/api/workouts", {
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
  return apiFetch<Workout>(`/api/workouts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
