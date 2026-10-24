import { listFriends } from "@/server/social";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "friends.list", auth: "user" }, ({ userId }) => listFriends(userId));
