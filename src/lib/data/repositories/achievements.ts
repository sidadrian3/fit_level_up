import type { Achievement } from "@/lib/types";
import { apiFetch } from "./api-fetch";

export async function getAchievements(): Promise<readonly Achievement[]> {
  return apiFetch<readonly Achievement[]>("/api/achievements");
}
