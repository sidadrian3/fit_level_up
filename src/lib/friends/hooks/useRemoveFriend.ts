"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeFriend } from "../api";
import { friendKeys } from "../keys";

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation<{ success: true }, Error, string>({
    mutationFn: removeFriend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.all });
    },
    onError: (err) => console.error("Failed to remove friend", err),
  });
}
