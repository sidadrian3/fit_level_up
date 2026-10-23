import { UserStateService } from "@/lib/services/users/user-state.service";
import { defineRoute } from "@/server/runtime";

export const GET = defineRoute({ name: "user.get", auth: "user" }, ({ userId }) => UserStateService.getUser(userId));
