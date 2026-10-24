import { ClientSession } from "mongodb";
import { getUserFromDb, applyUserActivityInDb } from "@/lib/data/user-db";
import { calcLevelUp } from "@/lib/domain/user-rules";
import { calcNewStreak, calcDisplayStreak, calcRecoveredStamina } from "@/server/progression";
import { toLocalDay } from "@/shared/time/calendar";
import type { User } from "@/lib/types";
import { NotFoundError } from "@/server/platform/http";
import { emit } from "@/server/platform/events";

export interface ActivityPayload {
    xpEarned: number;
    activityAt: Date;
    staminaCost: number;
    stats: {
        incrementWorkouts?: number;
        incrementDistance?: number;
    };
}

async function requireUserFromDb(userId: string, session?: ClientSession): Promise<User> {
    const user = await getUserFromDb(userId, session);
    if (!user) {
        throw new NotFoundError("User not found");
    }
    return user;
}

export const UserStateService = {
    async getUser(userId: string, session?: ClientSession): Promise<User> {
        const rawUser = await requireUserFromDb(userId, session);
        
        const displayStreak = calcDisplayStreak(
            rawUser.streak,
            rawUser.lastActivityDate,
            new Date(),
            rawUser.timeZone
        );

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
        session: ClientSession
    ): Promise<{ user: User; levelUp: boolean }> {
        try {
            // 1. Fetch current state
            const user = await requireUserFromDb(userId, session);

            // 2. Pure domain calculations
            const { newXp, newLevel, newXpToNextLevel, levelUp } = calcLevelUp(
                user.xp,
                user.level,
                user.xpToNextLevel,
                payload.xpEarned
            );

            const newStreak = calcNewStreak(user.streak, user.lastActivityDate, payload.activityAt, user.timeZone);

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
                    lastActivityDate: new Date(`${toLocalDay(payload.activityAt, user.timeZone)}T00:00:00Z`),
                    newStamina: finalStamina,
                    lastStaminaUpdate: new Date(),
                    incrementWorkouts: payload.stats.incrementWorkouts,
                    incrementDistance: payload.stats.incrementDistance,
                },
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
};
