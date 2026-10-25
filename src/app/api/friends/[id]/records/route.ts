import { getFriendRecords } from "@/server/social";
import { idParams } from "@/server/platform/http";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute(
  { name: "friends.records", auth: "user", params: idParams },
  ({ userId, params }) => getFriendRecords(userId, params.id)
);
