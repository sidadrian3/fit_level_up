"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateWorkoutInput, Workout } from "@/shared/contracts/workout";
import { invalidateActivityEffects } from "@/lib/progression/utils/invalidate-activity-effects";
import { isIdempotencyKeyReused } from "@/lib/shared/api-fetch";
import { createWorkout } from "../api";
import { workoutKeys } from "../keys";

interface LogWorkoutVariables {
  input: CreateWorkoutInput;
  idempotencyKey: string;
}

export function useLogWorkout() {
  const queryClient = useQueryClient();
  const invalidateWorkoutEffects = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
      invalidateActivityEffects(queryClient),
    ]);

  return useMutation<Workout, Error, LogWorkoutVariables>({
    mutationFn: ({ input, idempotencyKey }) => createWorkout(input, idempotencyKey),
    onSuccess: invalidateWorkoutEffects,
    onError: (err) => (isIdempotencyKeyReused(err) ? invalidateWorkoutEffects() : undefined),
  });
}
