import { getPersonalRecords } from "@/server/training";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "profile.records", auth: "user" }, ({ userId }) => getPersonalRecords(userId));
