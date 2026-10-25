import { removeFriend } from "@/server/social";
import { idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const DELETE = defineRoute(
  { name: "friends.remove", auth: "user", throttle: "standard", body: null, params: idParams },
  ({ userId, params }) => removeFriend(params.id, userId)
);
