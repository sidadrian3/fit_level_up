"use client";

import { useQuery } from "@tanstack/react-query";
import type { PaginatedResponse } from "@/shared/contracts/pagination";
import type { Run } from "@/shared/contracts/run";
import { getRuns } from "../api";
import { runKeys } from "../keys";

export function useRuns(page: number, limit: number) {
  return useQuery<PaginatedResponse<Run>>({
    queryKey: runKeys.list(page, limit),
    queryFn: () => getRuns(page, limit),
  });
}
