"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateActivityChange } from "@/lib/progression/utils/invalidate-activity-change";
import { deleteWorkout } from "../api";
import { workoutKeys } from "../keys";

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: deleteWorkout,
    onSuccess: () => invalidateActivityChange(queryClient, workoutKeys.all),
  });
}
