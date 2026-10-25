import type { NotificationDoc } from "@/server/platform/database";
import type { Notification } from "@/shared/contracts/notification";
import { countUnread, findFeed } from "./notification.repository";

function toNotification(doc: NotificationDoc): Notification {
  const { actor, type, data } = doc;
  return {
    id: doc._id.toString(),
    actor,
    type,
    data,
    createdAt: doc.createdAt.toISOString(),
    readAt: doc.readAt?.toISOString() ?? null,
  } as Notification;
}

export async function listNotifications(
  userId: string,
  since?: Date,
): Promise<{ items: Notification[]; unreadCount: number }> {
  const [docs, unreadCount] = await Promise.all([findFeed(userId, since), countUnread(userId)]);
  return { items: docs.map(toNotification), unreadCount };
}
