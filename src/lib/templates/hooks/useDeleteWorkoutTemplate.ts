"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteWorkoutTemplate } from "../api";
import { templateKeys } from "../keys";

export function useDeleteWorkoutTemplate() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteWorkoutTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}
