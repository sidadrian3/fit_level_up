"use client";

import { useQuery } from "@tanstack/react-query";
import type { PaginatedResponse } from "@/shared/contracts/pagination";
import type { Workout } from "@/shared/contracts/workout";
import { getWorkouts } from "../api";
import { workoutKeys } from "../keys";

export function useWorkouts(page: number, limit: number) {
  return useQuery<PaginatedResponse<Workout>>({
    queryKey: workoutKeys.list(page, limit),
    queryFn: () => getWorkouts(page, limit),
  });
}
