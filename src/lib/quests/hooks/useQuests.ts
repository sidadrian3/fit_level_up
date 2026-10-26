"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Quest } from "@/shared/contracts/quest";
import { getQuests } from "../api";
import { questKeys } from "../keys";

export function useQuests(): UseQueryResult<readonly Quest[], Error> {
  return useQuery<readonly Quest[]>({
    queryKey: questKeys.list(),
    queryFn: getQuests,
  });
}
