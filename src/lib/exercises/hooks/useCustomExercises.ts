"use client";

import { useQuery } from "@tanstack/react-query";
import type { CustomExercise } from "@/shared/contracts/exercise";
import { fetchCustomExercises } from "../api";
import { exerciseKeys } from "../keys";

export function useCustomExercises() {
  return useQuery<CustomExercise[]>({
    queryKey: exerciseKeys.custom(),
    queryFn: fetchCustomExercises,
  });
}
