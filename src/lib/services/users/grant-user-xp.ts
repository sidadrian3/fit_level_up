import type { User } from "@/lib/types";
import { updateUserXPInDb } from "@/lib/data/user-db";
import { UserStateService } from "@/lib/services/users/user-state.service";
import { calcLevelUp } from "@/lib/domain/user-rules";
import { ClientSession } from "mongodb";
import { emit } from "@/server/platform/events";


export async function grantUserXP(userId: string, amount: number, session: ClientSession): Promise<{ user: User; levelUp: boolean }> {
  try {
    const user = await UserStateService.getUser(userId, session);

    const { newXp, newLevel, newXpToNextLevel, levelUp } = calcLevelUp(
      user.xp,
      user.level,
      user.xpToNextLevel,
      amount
    );

    const updatedUser = await updateUserXPInDb(
      userId,
      newXp,
      newLevel,
      newXpToNextLevel,
      user.__v ?? 0,
      session
    );

    if (levelUp) {
      await emit("progression.leveled-up", { userId, previousLevel: user.level, newLevel }, { session });
    }

    return { user: updatedUser, levelUp };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "OptimisticLockError") {
      (error as Error & { errorLabels?: string[] }).errorLabels = ["TransientTransactionError"];
    }
    throw error;
  }
}
