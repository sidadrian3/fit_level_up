"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateCustomExerciseInput, CustomExercise } from "@/shared/contracts/exercise";
import { createCustomExercise } from "../api";
import { exerciseKeys } from "../keys";

export function useCreateCustomExercise() {
  const queryClient = useQueryClient();
  return useMutation<CustomExercise, Error, CreateCustomExerciseInput>({
    mutationFn: createCustomExercise,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all });
    },
  });
}
