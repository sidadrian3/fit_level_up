import type { User } from "@/lib/types";
import { UserStateService } from "@/lib/services/users/user-state.service";

export async function getUser(userId: string): Promise<User> {
  return UserStateService.getUser(userId);
}
