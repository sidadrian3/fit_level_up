"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateWorkoutInput, Workout } from "@/shared/contracts/workout";
import { invalidateActivityChange } from "@/lib/progression/utils/invalidate-activity-change";
import { isIdempotencyKeyReused } from "@/lib/shared/api-fetch";
import { createWorkout } from "../api";
import { workoutKeys } from "../keys";

interface LogWorkoutVariables {
  input: CreateWorkoutInput;
  idempotencyKey: string;
}

export function useLogWorkout() {
  const queryClient = useQueryClient();
  const invalidateWorkoutChange = () => invalidateActivityChange(queryClient, workoutKeys.all);

  return useMutation<Workout, Error, LogWorkoutVariables>({
    mutationFn: ({ input, idempotencyKey }) => createWorkout(input, idempotencyKey),
    onSuccess: invalidateWorkoutChange,
    onError: (err) => (isIdempotencyKeyReused(err) ? invalidateWorkoutChange() : undefined),
  });
}
