import { apiFetch } from "@/lib/shared/api-fetch";
import type { PersonalRecord } from "@/shared/contracts/personal-record";

export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  return apiFetch<PersonalRecord[]>("/api/profile/records");
}
