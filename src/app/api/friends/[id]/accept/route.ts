import { acceptFriendRequest } from "@/server/social";
import { idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const POST = defineRoute(
  { name: "friends.accept", auth: "user", throttle: "standard", body: null, params: idParams },
  ({ userId, params }) => acceptFriendRequest(params.id, userId)
);
