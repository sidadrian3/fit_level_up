import type { MarkNotificationsReadInput } from "@/shared/contracts/notification";
import { countUnread, markRead } from "./notification.repository";

export async function markNotificationsRead(
  userId: string,
  input: MarkNotificationsReadInput,
  now: Date = new Date(),
): Promise<{ unreadCount: number }> {
  await markRead(userId, input, now);
  return { unreadCount: await countUnread(userId) };
}
