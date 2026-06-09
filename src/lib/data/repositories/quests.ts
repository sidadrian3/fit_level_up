import type { Quest } from "@/lib/types";
import { apiFetch, apiFetchAndNotify } from "./api-fetch";

export async function getQuests(): Promise<readonly Quest[]> {
  return apiFetch<readonly Quest[]>("/api/quests");
}

export async function claimQuest(id: string): Promise<void> {
  return apiFetchAndNotify<void>(`/api/quests/${id}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}
