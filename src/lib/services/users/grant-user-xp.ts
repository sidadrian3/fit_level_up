import type { User } from "@/lib/types";
import { getUserFromDb, updateUserXPInDb } from "@/lib/data/user-db";
import { calcLevelUp } from "@/lib/domain/user-rules";
import { ClientSession } from "mongodb";

export async function grantUserXP(userId: string, amount: number, session?: ClientSession): Promise<{ user: User; levelUp: boolean }> {
  let retries = 3;
  while (retries > 0) {
    try {
      const user = await getUserFromDb(userId, session);
      
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

      return { user: updatedUser, levelUp };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "OptimisticLockError") {
        if (session) {
          // If in a transaction, let the MongoDB driver natively retry the whole transaction
          (error as any).errorLabels = ["TransientTransactionError"];
          throw error;
        }
        retries--;
        if (retries === 0) throw new Error("Failed to grant XP due to high contention");
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed to grant XP");
}
