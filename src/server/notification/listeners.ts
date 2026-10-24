import type { ObjectId } from "mongodb";
import { getAccount } from "@/server/platform/auth";
import type { NotificationDoc } from "@/server/platform/database";
import { defineListener, type AnyListener } from "@/server/platform/events";
import { getAcceptedFriendIds } from "@/server/social";
import { upsertForRecipients, type NewNotification } from "./notification.repository";

type Content = NewNotification extends infer Row
  ? Row extends NewNotification
    ? Pick<Row, "actor" | "type" | "data">
    : never
  : never;

async function findActor(userId: string): Promise<NotificationDoc["actor"]> {
  const account = await getAccount(userId);
  return account && { userId, name: account.name, avatar: account.avatar };
}

function toRows(recipientIds: string[], sourceEventId: ObjectId, content: Content): NewNotification[] {
  const createdAt = new Date();
  return recipientIds.map((userId) => ({ ...content, userId, sourceEventId, createdAt, readAt: null }));
}

export const notificationListeners: AnyListener[] = [
  defineListener({
    name: "notification.friend-requested",
    event: "friendship.requested",
    handle: async ({ friendshipId, requesterId, receiverId }, { eventId }) => {
      const actor = await findActor(requesterId);
      await upsertForRecipients(toRows([receiverId], eventId, { actor, type: "friend.requested", data: { friendshipId } }));
    },
  }),
  defineListener({
    name: "notification.friend-accepted",
    event: "friendship.accepted",
    handle: async ({ friendshipId, requesterId, receiverId }, { eventId }) => {
      const actor = await findActor(receiverId);
      await upsertForRecipients(toRows([requesterId], eventId, { actor, type: "friend.accepted", data: { friendshipId } }));
    },
  }),
  defineListener({
    name: "notification.friend-leveled-up",
    event: "progression.leveled-up",
    handle: async ({ userId, newLevel }, { eventId }) => {
      const friendIds = await getAcceptedFriendIds(userId);
      if (friendIds.length === 0) return;
      const actor = await findActor(userId);
      await upsertForRecipients(toRows(friendIds, eventId, { actor, type: "friend.leveled-up", data: { newLevel } }));
    },
  }),
  defineListener({
    name: "notification.achievement-unlocked",
    event: "achievement.unlocked",
    handle: async ({ userId, achievementId }, { eventId }) => {
      await upsertForRecipients(toRows([userId], eventId, { actor: null, type: "achievement.unlocked", data: { achievementId } }));
    },
  }),
];
