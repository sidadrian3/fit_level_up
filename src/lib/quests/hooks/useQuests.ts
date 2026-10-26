"use client";

import { useQuery } from "@tanstack/react-query";
import type { Quest } from "@/shared/contracts/quest";
import { getQuests } from "../api";
import { questKeys } from "../keys";

export function useQuests() {
  return useQuery<readonly Quest[]>({
    queryKey: questKeys.list(),
    queryFn: getQuests,
  });
}
