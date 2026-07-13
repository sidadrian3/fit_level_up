import type { Run, CreateRunInput, PaginatedResponse } from "@/lib/types";
import { apiFetch } from "./api-fetch";

export async function getRuns(page = 1, limit = 4): Promise<PaginatedResponse<Run>> {
  return apiFetch<PaginatedResponse<Run>>(`/api/runs?page=${page}&limit=${limit}`);
}

export async function createRun(input: CreateRunInput): Promise<Run> {
  return apiFetch<Run>("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteRun(id: string): Promise<boolean> {
  await apiFetch<unknown>(`/api/runs/${id}`, { method: "DELETE" });
  return true;
}

export async function updateRun(
  id: string,
  input: CreateRunInput,
): Promise<Run> {
  return apiFetch<Run>(`/api/runs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getRunStats() {
  return apiFetch<{ totalKm: number; totalRuns: number; avgPace: number }>("/api/runs/stats");
}
