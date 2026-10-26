"use client";

import { useQuery } from "@tanstack/react-query";
import type { FriendProfile } from "@/shared/contracts/friendship";
import { getFriends } from "../api";
import { friendKeys } from "../keys";

export function useFriends() {
  return useQuery<FriendProfile[]>({
    queryKey: friendKeys.list(),
    queryFn: getFriends,
  });
}
