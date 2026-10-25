import { listFriendRequests } from "@/server/social";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "friends.requests", auth: "user" }, ({ userId }) => listFriendRequests(userId));
