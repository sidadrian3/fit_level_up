"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Friendship } from "@/shared/contracts/friendship";
import { declineFriendRequest } from "../api";
import { friendKeys } from "../keys";

export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation<Friendship, Error, string>({
    mutationFn: declineFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.requests() });
    },
    onError: (err) => console.error("Failed to decline request", err),
  });
}
