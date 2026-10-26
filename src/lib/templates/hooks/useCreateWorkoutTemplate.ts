"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateWorkoutTemplateInput, WorkoutTemplate } from "@/shared/contracts/template";
import { isIdempotencyKeyReused } from "@/lib/shared/api-fetch";
import { createWorkoutTemplate } from "../api";
import { templateKeys } from "../keys";

interface CreateWorkoutTemplateVariables {
  input: CreateWorkoutTemplateInput;
  idempotencyKey: string;
}

export function useCreateWorkoutTemplate() {
  const queryClient = useQueryClient();
  return useMutation<WorkoutTemplate, Error, CreateWorkoutTemplateVariables>({
    mutationFn: ({ input, idempotencyKey }) => createWorkoutTemplate(input, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
    onError: (err) => {
      if (isIdempotencyKeyReused(err)) {
        queryClient.invalidateQueries({ queryKey: templateKeys.all });
      }
    },
  });
}
