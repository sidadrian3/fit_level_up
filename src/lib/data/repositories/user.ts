import type { User } from "@/lib/types";
import { apiFetch } from "./api-fetch";

export async function getUser(): Promise<User> {
  return apiFetch<User>("/api/user");
}
