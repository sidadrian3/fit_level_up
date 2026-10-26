import { apiFetch } from "@/lib/shared/api-fetch";
import type {
  MarkNotificationsReadInput,
  Notification,
} from "@/shared/contracts/notification";

export async function getNotifications(
  since?: string,
): Promise<{ items: Notification[]; unreadCount: number }> {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiFetch<{ items: Notification[]; unreadCount: number }>(
    `/api/notifications${query}`,
  );
}

export async function markNotificationsRead(
  input: MarkNotificationsReadInput,
): Promise<{ unreadCount: number }> {
  return apiFetch<{ unreadCount: number }>("/api/notifications/read", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
