"use client";

import { useQuery } from "@tanstack/react-query";
import type { PersonalRecord } from "@/shared/contracts/personal-record";
import { getPersonalRecords } from "../api";
import { statsKeys } from "../keys";

export function usePersonalRecords() {
  return useQuery<PersonalRecord[]>({
    queryKey: statsKeys.personalRecords(),
    queryFn: getPersonalRecords,
  });
}
