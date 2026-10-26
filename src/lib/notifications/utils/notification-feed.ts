import type { Notification } from "@/shared/contracts/notification";
import {
  FAST_POLL_INTERVAL_MS,
  FAST_POLL_WINDOW_MS,
  NOTIFICATION_POLL_INTERVAL_MS,
} from "./constants";

export function mergeFeed(
  existing: Notification[],
  incoming: Notification[],
  limit: number,
): Notification[] {
  const byId = new Map<string, Notification>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}

export function selectToastBatch(
  incoming: Notification[],
  window: { loadedAt: number; visibleSince: number },
): Notification[] {
  const threshold = Math.max(window.loadedAt, window.visibleSince);
  return incoming.filter((item) => Date.parse(item.createdAt) > threshold);
}

export function nextPollInterval(now: number, fastUntil: number): number {
  return now < fastUntil
    ? FAST_POLL_INTERVAL_MS
    : NOTIFICATION_POLL_INTERVAL_MS;
}

export function extendFastWindow(now: number): number {
  return now + FAST_POLL_WINDOW_MS;
}
