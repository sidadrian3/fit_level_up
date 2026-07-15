import { apiFetch } from "./api-fetch";
import type { Friendship, FriendProfile } from "@/lib/types";

export async function getFriends(): Promise<FriendProfile[]> {
  return apiFetch<FriendProfile[]>("/api/friends");
}

export async function getFriendRequests(): Promise<FriendProfile[]> {
  return apiFetch<FriendProfile[]>("/api/friends/requests");
}

export async function sendFriendRequest(receiverId: string): Promise<Friendship> {
  return apiFetch<Friendship>("/api/friends/request", {
    method: "POST",
    body: JSON.stringify({ receiverId }),
  });
}

export async function acceptFriendRequest(id: string): Promise<Friendship> {
  return apiFetch<Friendship>(`/api/friends/${id}/accept`, {
    method: "POST",
  });
}

export async function declineFriendRequest(id: string): Promise<Friendship> {
  return apiFetch<Friendship>(`/api/friends/${id}/decline`, {
    method: "POST",
  });
}

export async function removeFriend(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/friends/${id}`, {
    method: "DELETE",
  });
}
