import type { User } from "@/shared/contracts/user";
import { apiFetch } from "@/lib/shared/api-fetch";

export async function getUser(): Promise<User> {
  return apiFetch<User>("/api/user");
}
