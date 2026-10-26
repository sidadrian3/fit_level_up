"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CustomExercise, TargetMuscle } from "@/shared/contracts/exercise";
import { createCustomExercise } from "../api";
import { exerciseKeys } from "../keys";

export function useCreateCustomExercise() {
  const queryClient = useQueryClient();
  return useMutation<CustomExercise, Error, { name: string; targetMuscle: TargetMuscle }>({
    mutationFn: createCustomExercise,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all });
    },
  });
}
