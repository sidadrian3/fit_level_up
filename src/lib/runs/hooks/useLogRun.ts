"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateRunInput, Run } from "@/shared/contracts/run";
import { invalidateActivityChange } from "@/lib/progression/utils/invalidate-activity-change";
import { isIdempotencyKeyReused } from "@/lib/shared/api-fetch";
import { createRun } from "../api";
import { runKeys } from "../keys";

interface LogRunVariables {
  input: CreateRunInput;
  idempotencyKey: string;
}

export function useLogRun() {
  const queryClient = useQueryClient();
  const invalidateRunChange = () => invalidateActivityChange(queryClient, runKeys.all);

  return useMutation<Run, Error, LogRunVariables>({
    mutationFn: ({ input, idempotencyKey }) => createRun(input, idempotencyKey),
    onSuccess: invalidateRunChange,
    onError: (err) => (isIdempotencyKeyReused(err) ? invalidateRunChange() : undefined),
  });
}
