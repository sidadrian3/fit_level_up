import { getFriends } from "@/lib/services/friends/get-friends";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "friends.list", auth: "user" }, ({ userId }) => getFriends(userId));
