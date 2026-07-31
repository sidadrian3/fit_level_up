import { ClientSession } from "mongodb";
import { getUserFromDb, applyUserActivityInDb } from "@/lib/data/user-db";
import { calcLevelUp, calcNewStreak, calcDisplayStreak } from "@/lib/domain/user-rules";
import { calcRecoveredStamina } from "@/lib/domain/stamina-rules";
import { notifyFriendsLevelUp } from "@/lib/services/friends/notify-friends-level-up";
import { after } from "next/server";
import type { User } from "@/lib/types";

export interface ActivityPayload {
    xpEarned: number;
    activityDate: Date;
    staminaCost: number;
    stats: {
        incrementWorkouts?: number;
        incrementDistance?: number;
    };
}

export const UserStateService = {
    async getUser(userId: string, session?: ClientSession): Promise<User> {
        const rawUser = await getUserFromDb(userId, session);
        
        const displayStreak = calcDisplayStreak(rawUser.streak, rawUser.lastActivityDate);

        const recoveredStamina = calcRecoveredStamina(
            rawUser.stamina,
            rawUser.lastStaminaUpdate,
            new Date()
        );

        return {
            ...rawUser,
            streak: displayStreak,
            stamina: recoveredStamina
        };
    },

    async applyActivity(
        userId: string,
        payload: ActivityPayload,
        session?: ClientSession
    ): Promise<{ user: User; levelUp: boolean }> {
        let retries = 3;
        while (retries > 0) {
            try {
                // 1. Fetch current state
                const user = await getUserFromDb(userId, session);

                // 2. Pure domain calculations
                const { newXp, newLevel, newXpToNextLevel, levelUp } = calcLevelUp(
                    user.xp,
                    user.level,
                    user.xpToNextLevel,
                    payload.xpEarned
                );

                const newStreak = calcNewStreak(
                    user.streak,
                    user.lastActivityDate ? new Date(user.lastActivityDate) : undefined,
                    payload.activityDate.toISOString().slice(0, 10)
                );

                const recoveredStamina = calcRecoveredStamina(
                    user.stamina,
                    user.lastStaminaUpdate,
                    new Date() // recovery calculated up to now
                );
                const finalStamina = Math.max(0, recoveredStamina - payload.staminaCost);

                // 3. Single Unified DB Update
                const updatedUser = await applyUserActivityInDb(
                    userId,
                    {
                        newXp,
                        newLevel,
                        newXpToNextLevel,
                        newStreak,
                        lastActivityDate: payload.activityDate,
                        newStamina: finalStamina,
                        lastStaminaUpdate: new Date(),
                        incrementWorkouts: payload.stats.incrementWorkouts,
                        incrementDistance: payload.stats.incrementDistance,
                    },
                    user.__v ?? 0,
                    session
                );

                // 4. Side Effects
                if (levelUp) {
                    after(
                        notifyFriendsLevelUp(userId, newLevel).catch(err => {
                            console.error(`[SSE] Failed to notify friends of level up for user ${userId}:`, err);
                        })
                    );
                }

                return { user: updatedUser, levelUp };
            } catch (error: unknown) {
                if (error instanceof Error && error.message === "OptimisticLockError") {
                    if (session) {
                        (error as Error & { errorLabels?: string[] }).errorLabels = ["TransientTransactionError"];
                        throw error;
                    }
                    retries--;
                    if (retries === 0) throw new Error("Failed to apply activity due to high contention");
                    continue;
                }
                throw error;
            }
        }
        throw new Error("Failed to apply activity");
    }
};
