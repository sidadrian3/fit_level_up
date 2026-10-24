import { getCollection, parseObjectId, userScopedRepository, type NotificationDoc } from "@/server/platform/database";

const notifications = userScopedRepository<NotificationDoc>("notifications");

const FEED_LIMIT_WITHOUT_SINCE = 20;
const FEED_LIMIT_WITH_SINCE = 50;

export type NewNotification = Omit<NotificationDoc, "_id">;

// The one cross-user write: each row is keyed by its recipient's userId and the source event.
export async function upsertForRecipients(rows: NewNotification[]): Promise<void> {
  if (rows.length === 0) return;
  const collection = await getCollection<NewNotification>("notifications");
  await collection.bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { userId: row.userId, sourceEventId: row.sourceEventId },
        update: { $setOnInsert: row },
        upsert: true,
      },
    })),
  );
}

export function findFeed(userId: string, since?: Date): Promise<NotificationDoc[]> {
  return notifications.find(
    userId,
    since ? { createdAt: { $gte: since } } : {},
    { limit: since ? FEED_LIMIT_WITH_SINCE : FEED_LIMIT_WITHOUT_SINCE, sort: { createdAt: -1, _id: -1 } },
  );
}

export function countUnread(userId: string): Promise<number> {
  return notifications.count(userId, { readAt: null });
}

export async function markRead(userId: string, target: { ids: string[] } | { all: true }, now: Date): Promise<void> {
  const idFilter = "all" in target ? {} : { _id: { $in: target.ids.flatMap((id) => parseObjectId(id) ?? []) } };
  const collection = await getCollection<NotificationDoc>("notifications");
  await collection.updateMany({ ...idFilter, userId, readAt: null }, { $set: { readAt: now } });
}
