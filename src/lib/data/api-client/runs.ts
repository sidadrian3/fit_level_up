import type { Run, CreateRunInput } from "@/lib/types";
import { apiFetch, apiFetchAndNotify } from "./api-fetch";

export async function getRuns(): Promise<readonly Run[]> {
  return apiFetch<readonly Run[]>("/api/runs");
}

export async function createRun(input: CreateRunInput): Promise<Run> {
  return apiFetchAndNotify<Run>("/api/runs", {
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
  return apiFetchAndNotify<Run>(`/api/runs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
