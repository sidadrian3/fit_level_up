import { getUser } from "@/server/progression";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "user.get", auth: "user" }, ({ userId }) => getUser(userId));
