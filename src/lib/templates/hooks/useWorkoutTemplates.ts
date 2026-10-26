"use client";

import { useQuery } from "@tanstack/react-query";
import type { WorkoutTemplate } from "@/shared/contracts/template";
import { fetchWorkoutTemplates } from "../api";
import { templateKeys } from "../keys";

export function useWorkoutTemplates({ enabled }: { enabled: boolean }) {
  return useQuery<WorkoutTemplate[]>({
    queryKey: templateKeys.list(),
    queryFn: fetchWorkoutTemplates,
    enabled,
  });
}
