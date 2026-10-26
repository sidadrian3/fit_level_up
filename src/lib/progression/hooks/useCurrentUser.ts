"use client";

import { useQuery } from "@tanstack/react-query";
import type { User } from "@/shared/contracts/user";
import { getCurrentUser } from "../api";
import { progressionKeys } from "../keys";

export function useCurrentUser(): { user: User | null; loading: boolean; error: Error | null } {
  const { data, isLoading, error } = useQuery<User>({
    queryKey: progressionKeys.current(),
    queryFn: getCurrentUser,
    retry: false,
  });
  return { user: data ?? null, loading: isLoading, error };
}
