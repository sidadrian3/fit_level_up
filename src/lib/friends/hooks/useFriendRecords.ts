"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import type { PersonalRecord } from "@/shared/contracts/personal-record";
import { getFriendRecords } from "../api";
import { friendKeys } from "../keys";

export function useFriendRecords(friendId: string | null) {
  return useQuery<PersonalRecord[]>({
    // The key is never fetched while friendId is null (skipToken disables the query).
    queryKey: friendKeys.records(friendId ?? ""),
    queryFn: friendId === null ? skipToken : () => getFriendRecords(friendId),
  });
}
