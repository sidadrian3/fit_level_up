"use client";

import { useMutation } from "@tanstack/react-query";
import type { Friendship } from "@/shared/contracts/friendship";
import { sendFriendRequest } from "../api";

export function useSendFriendRequest() {
  return useMutation<Friendship, Error, string>({
    mutationFn: sendFriendRequest,
  });
}
