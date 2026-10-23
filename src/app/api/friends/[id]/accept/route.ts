import { acceptFriendRequest } from "@/lib/services/friends/accept-friend-request";
import { idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const POST = defineRoute(
  { name: "friends.accept", auth: "user", throttle: "standard", body: null, params: idParams },
  ({ userId, params }) => acceptFriendRequest(params.id, userId)
);
