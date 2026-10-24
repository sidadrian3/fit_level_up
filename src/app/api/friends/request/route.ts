import { sendFriendRequest } from "@/server/social";
import { SendFriendRequestSchema } from "@/shared/contracts/friendship";
import { defineRoute } from "@/server/runtime";

export const POST = defineRoute(
  { name: "friends.request", auth: "user", throttle: "expensive", body: SendFriendRequestSchema, status: 201 },
  ({ userId, body }) => sendFriendRequest(userId, body.receiverId)
);
