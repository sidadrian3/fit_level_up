import type { DashboardStats } from "@/lib/types";
import { apiFetch } from "./api-fetch";

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/api/stats/dashboard");
}
