import { WorkoutTemplate, CreateWorkoutTemplateInput } from "../../types";
import { apiFetch } from "@/lib/shared/api-fetch";

export async function fetchWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  return apiFetch<WorkoutTemplate[]>("/api/workout-templates");
}

export async function createWorkoutTemplate(
  input: CreateWorkoutTemplateInput,
  idempotencyKey: string,
): Promise<WorkoutTemplate> {
  return apiFetch<WorkoutTemplate>("/api/workout-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    idempotencyKey,
  });
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  return apiFetch<void>(`/api/workout-templates/${id}`, {
    method: "DELETE",
  });
}
