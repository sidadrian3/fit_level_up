import { markNotificationsRead } from "@/server/notification";
import { defineRoute } from "@/server/runtime";
import { MarkNotificationsReadSchema } from "@/shared/contracts/notification";

export const PATCH = defineRoute(
  { name: "notifications.read", auth: "user", throttle: "standard", body: MarkNotificationsReadSchema },
  ({ userId, body }) => markNotificationsRead(userId, body)
);
