"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateWorkoutInput, Workout } from "@/shared/contracts/workout";
import { invalidateActivityChange } from "@/lib/progression/utils/invalidate-activity-change";
import { updateWorkout } from "../api";
import { workoutKeys } from "../keys";

interface UpdateWorkoutVariables {
  id: string;
  input: CreateWorkoutInput;
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();
  return useMutation<Workout, Error, UpdateWorkoutVariables>({
    mutationFn: ({ id, input }) => updateWorkout(id, input),
    onSuccess: () => invalidateActivityChange(queryClient, workoutKeys.all),
  });
}
