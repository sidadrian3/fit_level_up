import { listNotifications } from "@/server/notification";
import { defineRoute } from "@/server/runtime";
import { NotificationsQuerySchema } from "@/shared/contracts/notification";

export const GET = defineRoute(
  { name: "notifications.list", auth: "user", query: NotificationsQuerySchema },
  ({ userId, query: { since } }) => listNotifications(userId, since ? new Date(since) : undefined)
);
