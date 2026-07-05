import type { DashboardStats } from "@/lib/types";
import { apiFetch } from "./api-fetch";
import type { PersonalRecord } from "@/lib/utils";

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/api/stats/dashboard");
}

export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  return apiFetch<PersonalRecord[]>("/api/profile/records");
}
