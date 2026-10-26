"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateActivityChange } from "@/lib/progression/utils/invalidate-activity-change";
import { deleteRun } from "../api";
import { runKeys } from "../keys";

export function useDeleteRun() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: deleteRun,
    onSuccess: () => invalidateActivityChange(queryClient, runKeys.all),
  });
}
