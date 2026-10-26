"use client";

import { useQuery } from "@tanstack/react-query";
import type { FriendProfile } from "@/shared/contracts/friendship";
import { getFriendRequests } from "../api";
import { friendKeys } from "../keys";

export function useFriendRequests() {
  return useQuery<FriendProfile[]>({
    queryKey: friendKeys.requests(),
    queryFn: getFriendRequests,
  });
}
