"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateActivityEffects } from "@/lib/progression/utils/invalidate-activity-effects";
import { deleteWorkout } from "../api";
import { workoutKeys } from "../keys";

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: deleteWorkout,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
        invalidateActivityEffects(queryClient),
      ]),
  });
}
