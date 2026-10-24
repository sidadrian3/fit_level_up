import { getUser } from "@/lib/services/users/get-user";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "user.get", auth: "user" }, ({ userId }) => getUser(userId));
