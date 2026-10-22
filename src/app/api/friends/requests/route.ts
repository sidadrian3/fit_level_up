import { getFriendRequests } from "@/lib/services/friends/get-friend-requests";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "friends.requests", auth: "user" }, ({ userId }) => getFriendRequests(userId));
