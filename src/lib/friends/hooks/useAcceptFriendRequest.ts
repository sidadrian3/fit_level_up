"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Friendship } from "@/shared/contracts/friendship";
import { acceptFriendRequest } from "../api";
import { friendKeys } from "../keys";

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation<Friendship, Error, string>({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.all });
    },
    onError: (err) => console.error("Failed to accept request", err),
  });
}
