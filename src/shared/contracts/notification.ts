import { z } from "zod";

export type Notification = {
  id: string;
  actor: { userId: string; name: string; avatar: string } | null;
  createdAt: string;
  readAt: string | null;
} & (
  | { type: "friend.requested" | "friend.accepted"; data: { friendshipId: string } }
  | { type: "friend.leveled-up"; data: { newLevel: number } }
  | { type: "achievement.unlocked"; data: { achievementId: string } }
);

export const NotificationsQuerySchema = z.object({
  since: z.iso.datetime().optional(),
});

export const MarkNotificationsReadSchema = z.union([
  z.object({ ids: z.array(z.string()).min(1).max(50) }),
  z.object({ all: z.literal(true) }),
]);

export type MarkNotificationsReadInput = z.infer<typeof MarkNotificationsReadSchema>;
