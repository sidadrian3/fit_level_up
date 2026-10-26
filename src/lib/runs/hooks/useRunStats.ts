"use client";

import { useQuery } from "@tanstack/react-query";
import type { RunStats } from "@/shared/contracts/run";
import { getRunStats } from "../api";
import { runKeys } from "../keys";

export function useRunStats() {
  return useQuery<RunStats>({
    queryKey: runKeys.stats(),
    queryFn: getRunStats,
  });
}
