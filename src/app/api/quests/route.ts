import { getUserQuests } from "@/lib/services/quests/get-user-quests";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "quests.list", auth: "user" }, ({ userId }) => getUserQuests(userId));
