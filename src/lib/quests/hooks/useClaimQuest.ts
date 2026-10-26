"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { progressionKeys } from "@/lib/progression/keys";
import { claimQuest } from "../api";
import { questKeys } from "../keys";

export function useClaimQuest(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: claimQuest,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: questKeys.all }),
        queryClient.invalidateQueries({ queryKey: progressionKeys.all }),
      ]);
    },
  });
}
