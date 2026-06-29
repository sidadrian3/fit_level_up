import type { User } from "@/lib/types";
import { getUserFromDb, updateUserXPInDb } from "@/lib/data/user-db";
import { calcLevelUp } from "@/lib/domain/user-rules";
import { ClientSession } from "mongodb";

export async function grantUserXP(userId: string, amount: number, session?: ClientSession): Promise<{ user: User; levelUp: boolean }> {
  const user = await getUserFromDb(userId);
  
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
    session
  );

  return { user: updatedUser, levelUp };
}
