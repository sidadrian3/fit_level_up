import { declineFriendRequest } from "@/lib/services/friends/decline-friend-request";
import { idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const POST = defineRoute(
  { name: "friends.decline", auth: "user", throttle: "standard", body: null, params: idParams },
  ({ userId, params }) => declineFriendRequest(params.id, userId)
);
