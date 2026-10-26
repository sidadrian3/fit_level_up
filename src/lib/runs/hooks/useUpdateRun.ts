"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateRunInput, Run } from "@/shared/contracts/run";
import { invalidateActivityChange } from "@/lib/progression/utils/invalidate-activity-change";
import { updateRun } from "../api";
import { runKeys } from "../keys";

interface UpdateRunVariables {
  id: string;
  input: CreateRunInput;
}

export function useUpdateRun() {
  const queryClient = useQueryClient();
  return useMutation<Run, Error, UpdateRunVariables>({
    mutationFn: ({ id, input }) => updateRun(id, input),
    onSuccess: () => invalidateActivityChange(queryClient, runKeys.all),
  });
}
