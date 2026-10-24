import { getQuests } from "@/server/quests";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "quests.list", auth: "user" }, ({ userId }) => getQuests(userId));
